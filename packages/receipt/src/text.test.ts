import { describe, expect, it } from "vitest";
import { formatReceiptDateTime } from "./document";
import { buildReceiptText } from "./text";
import type { ReceiptData } from "./types";

/** Cupom mínimo válido, sobrescrito por teste conforme o caso. */
function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    saleId: 142291,
    createdAt: "2026-07-25T12:30:15",
    items: [{ name: "CHICLETE DE BOLA", quantity: 2, unitPrice: 0.5 }],
    payments: [{ name: "Dinheiro", amount: 1 }],
    discount: 0,
    total: 1,
    store: { name: "UAUS! MÁXIMO 30" },
    ...overrides,
  };
}

/** Linhas do texto, para conferir a ordem sem depender da quebra exata. */
const lines = (text: string) => text.split("\n");

describe("buildReceiptText", () => {
  it("abre com a loja, o número e a data, e fecha com o aviso fiscal", () => {
    const text = buildReceiptText(makeReceipt());

    expect(lines(text).slice(0, 3)).toEqual([
      "*UAUS! MÁXIMO 30*",
      "Comprovante da venda 142291",
      // A mesma formatação do papel (e do mesmo fuso): o texto não inventa a sua.
      formatReceiptDateTime("2026-07-25T12:30:15"),
    ]);
    expect(lines(text).at(-1)).toBe("Documento sem valor fiscal");
  });

  it("item, total em negrito e pagamento, sem o espaço inquebrável do R$", () => {
    const text = buildReceiptText(makeReceipt());

    expect(text).toContain("CHICLETE DE BOLA — R$ 1,00\n   2 UN x R$ 0,50");
    expect(text).toContain("*TOTAL: R$ 1,00*");
    expect(text).toContain("Pagamento: Dinheiro R$ 1,00");
    expect(text).not.toMatch(/\u00a0/);
  });

  it("fecha a mesma conta do papel: promoção, desconto, cupom, troco e economia", () => {
    // Esmalte de tabela R$ 7,00, vendido a R$ 6,00: R$ 0,70 de promoção e R$ 0,30
    // de desconto do balcão, por unidade. Duas unidades; R$ 2,00 de desconto da
    // venda; cupom de R$ 1,00. Pago R$ 20,00 em dinheiro, total R$ 9,00.
    const text = buildReceiptText(
      makeReceipt({
        items: [
          {
            name: "ESMALTE RISQUÉ",
            quantity: 2,
            unitPrice: 6,
            unitDiscount: 1,
            unitPromotionDiscount: 0.7,
          },
        ],
        discount: 2,
        coupon: { code: "10OFF", label: "R$ 1,00", amount: 1 },
        total: 9,
        payments: [{ name: "Dinheiro", amount: 9 }],
        amountReceived: 20,
        change: 11,
      }),
    );

    // A âncora da conta do item: o total líquido, a tabela, e o que abateu —
    // 2 × 7,00 − 1,40 − 0,60 = 12,00, que é o que a linha diz.
    expect(text).toContain(
      "ESMALTE RISQUÉ — R$ 12,00\n   2 UN x R$ 7,00\n   Promoção - R$ 1,40\n   Desconto - R$ 0,60",
    );
    expect(text).toContain("Subtotal: R$ 12,00");
    expect(text).toContain("Desconto: - R$ 2,00");
    expect(text).toContain("Cupom 10OFF (R$ 1,00): - R$ 1,00");
    expect(text).toContain("*TOTAL: R$ 9,00*");
    expect(text).toContain("Recebido: R$ 20,00");
    expect(text).toContain("Troco: R$ 11,00");
    expect(text).toContain("Você economizou R$ 1,40");
  });

  it("sem abatimento, sem a linha de subtotal (como no papel)", () => {
    expect(buildReceiptText(makeReceipt())).not.toContain("Subtotal");
  });

  it("acréscimo com o motivo na linha do item", () => {
    const text = buildReceiptText(
      makeReceipt({
        items: [
          {
            name: "PENDRIVE",
            quantity: 1,
            unitPrice: 30,
            unitSurcharge: 5,
            surchargeReason: "Gravação de músicas",
          },
        ],
        total: 30,
      }),
    );

    // 25,00 de tabela + 5,00 de acréscimo = os 30,00 da linha.
    expect(text).toContain(
      "PENDRIVE — R$ 30,00\n   1 UN x R$ 25,00\n   Acréscimo + R$ 5,00 (Gravação de músicas)",
    );
  });

  it("desconto do balcão: a linha da tabela é o que faz a conta fechar para quem lê", () => {
    // Revisão de 07/10/2026: sem a tabela, "R$ 20,00" e "Desconto - R$ 2,00"
    // pareciam dar R$ 18,00, e o cliente da entrega leria que o desconto não veio.
    const text = buildReceiptText(
      makeReceipt({
        items: [{ name: "CARREGADOR", quantity: 1, unitPrice: 20, unitDiscount: 2 }],
        total: 20,
      }),
    );

    expect(text).toContain("CARREGADOR — R$ 20,00\n   1 UN x R$ 22,00\n   Desconto - R$ 2,00");
  });

  it("item a peso sai com a unidade", () => {
    const text = buildReceiptText(
      makeReceipt({ items: [{ name: "QUEIJO", quantity: 0.35, unitPrice: 40, unit: "KG" }], total: 14 }),
    );

    expect(text).toContain("   0,35 KG x R$ 40,00");
  });

  it("venda offline avisa que o número é provisório", () => {
    const text = buildReceiptText(makeReceipt({ saleId: "OFF-14", offline: true }));

    expect(text).toContain("Comprovante da venda OFF-14");
    expect(text).toContain("número provisório");
  });

  it("parcelas e pagamento dividido", () => {
    const text = buildReceiptText(
      makeReceipt({
        payments: [
          { name: "Crédito", amount: 30, installments: 3 },
          { name: "Pix", amount: 10 },
        ],
        total: 40,
      }),
    );

    expect(text).toContain("Pagamento: Crédito (3x) R$ 30,00 + Pix R$ 10,00");
  });

  it("o saldo do cartão fidelidade, quando a venda tem", () => {
    const text = buildReceiptText(
      makeReceipt({
        loyalty: {
          stamped: true,
          stamps: 8,
          stampsRequired: 10,
          toNextReward: 2,
          nextRewardLabel: "R$ 5,00",
        },
      }),
    );

    expect(text).toContain("Cartão fidelidade: 8 de 10 carimbos.");
    expect(text).toContain("Faltam 2 para o prêmio de R$ 5,00.");
  });
});
