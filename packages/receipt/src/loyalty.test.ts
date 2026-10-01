import { describe, expect, it } from "vitest";
import { buildLoyaltyStatementHtml, loyaltyReceiptBlock } from "./loyalty";
import { buildReceiptHtml } from "./render";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("bloco do cartão fidelidade no comprovante", () => {
  it("diz que a compra carimbou, o saldo e o que falta", () => {
    const block = text(
      loyaltyReceiptBlock({
        stamped: true,
        stamps: 8,
        stampsRequired: 10,
        toNextReward: 2,
        nextRewardLabel: "R$ 5,00",
        expiresAt: "2027-11-03T23:59:59",
      }),
    );

    expect(block).toContain("CARTÃO FIDELIDADE");
    expect(block).toContain("Esta compra ganhou 1 carimbo.");
    expect(block).toContain("Saldo: 8 de 10 carimbos.");
    expect(block).toContain("Faltam 2 para o próximo prêmio de R$ 5,00.");
    expect(block).toContain("Válido até 03/11/2027.");
  });

  it("na compra abaixo do mínimo, diz por que não carimbou", () => {
    const block = text(
      loyaltyReceiptBlock({
        stamped: false,
        reason: "mínimo de R$ 10,00",
        stamps: 7,
        stampsRequired: 10,
        toNextReward: 3,
        nextRewardLabel: "R$ 5,00",
      }),
    );

    expect(block).toContain("Esta compra não ganhou carimbo (mínimo de R$ 10,00).");
  });

  it("só aparece no cupom quando a venda manda o saldo", () => {
    const base = { saleId: 10, createdAt: "2026-11-03T10:00:00", items: [], payments: [], total: 0 };

    expect(buildReceiptHtml(base)).not.toContain("CARTÃO FIDELIDADE");
    expect(
      buildReceiptHtml({
        ...base,
        loyalty: {
          stamped: true,
          stamps: 1,
          stampsRequired: 10,
          toNextReward: 4,
          nextRewardLabel: "R$ 5,00",
        },
      }),
    ).toContain("CARTÃO FIDELIDADE");
  });
});

describe("extrato do cartão", () => {
  it("lista cada carimbo com a data e os prêmios", () => {
    const html = text(
      buildLoyaltyStatementHtml({
        customerName: "Ana do salão",
        stamps: [
          { position: 1, occurredAt: "2026-11-03T10:00:00", bonus: true },
          { position: 2, occurredAt: "2026-11-10T10:00:00" },
        ],
        stampsRequired: 10,
        expiresAt: "2027-11-03T23:59:59",
        rewardLines: ["1º prêmio (R$ 5,00): trocado em 21/12/2026"],
        printedAt: "2026-11-11T09:00:00",
      }),
    );

    expect(html).toContain("Ana do salão");
    expect(html).toContain("1º (extra) 03/11/2026");
    expect(html).toContain("2º 10/11/2026");
    expect(html).toContain("2 de 10 carimbos");
    expect(html).toContain("trocado em 21/12/2026");
    expect(html).toContain("A via oficial é a digital.");
  });
});
