import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReceiptHtml, computeItemsSubtotal } from "./render";
import { STORE_LOGO_DATA_URI } from "./logo";
import { STORE_INFO } from "./store-info";
import type { ReceiptData } from "./types";

/** Cupom mínimo válido, sobrescrito por teste conforme o caso. */
function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    saleId: 142291,
    createdAt: "2026-07-25T12:30:15",
    operatorName: "Eduardo Henrique",
    items: [{ name: "CHICLETE DE BOLA", quantity: 1, unitPrice: 0.25 }],
    payments: [{ name: "Dinheiro", amount: 0.25 }],
    discount: 0,
    total: 0.25,
    ...overrides,
  };
}

describe("computeItemsSubtotal", () => {
  it("soma os itens arredondando para duas casas", () => {
    expect(
      computeItemsSubtotal([
        { name: "A", quantity: 3, unitPrice: 0.1 },
        { name: "B", quantity: 1, unitPrice: 0.2 },
      ]),
    ).toBe(0.5);
  });

  it("é zero sem itens", () => {
    expect(computeItemsSubtotal([])).toBe(0);
  });
});

describe("buildReceiptHtml", () => {
  it("dimensiona a página para a bobina de 80mm", () => {
    expect(buildReceiptHtml(makeReceipt())).toContain("@page { size: 80mm auto; margin: 0; }");
  });

  it("imprime a identificação da loja e a logo embutida", () => {
    const html = buildReceiptHtml(makeReceipt());

    expect(html).toContain(STORE_INFO.name);
    expect(html).toContain("CNPJ: 64.958.682/0001-22");
    expect(html).toContain('src="data:image/png;base64,');
  });

  it("aceita dados de loja específicos daquele cupom", () => {
    const html = buildReceiptHtml(makeReceipt({ store: { name: "OUTRA LOJA" } }));

    expect(html).toContain("OUTRA LOJA");
    expect(html).not.toContain(STORE_INFO.name);
  });

  it("detalha item, quantidade e forma de pagamento", () => {
    const html = buildReceiptHtml(makeReceipt());

    expect(html).toContain("CHICLETE DE BOLA");
    expect(html).toContain("1 UN x");
    expect(html).toContain("Dinheiro");
  });

  it("identifica o consumidor pelo documento, na mesma linha do rótulo", () => {
    const html = buildReceiptHtml(makeReceipt({ customerDocument: "123.456.789-00" }));

    expect(html).toContain('<div class="consumer">CONSUMIDOR: 123.456.789-00</div>');
  });

  it("imprime o código de barras acima da descrição do item", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CHICLETE", quantity: 1, unitPrice: 0.25, barcode: "7891234567890" }],
      }),
    );

    expect(html).toContain('<div class="item-barcode">7891234567890</div>');
    // O código vem antes do nome dentro do bloco do item.
    expect(html.indexOf("7891234567890")).toBeLessThan(html.indexOf("CHICLETE<"));
  });

  it("omite a linha do código quando o item não o traz", () => {
    // É o caso da reimpressão: o item de venda da API não carrega o código.
    expect(buildReceiptHtml(makeReceipt())).not.toContain("item-barcode\">");
  });

  it("ordena as seções: itens, totais, forma de pagamento e consumidor", () => {
    const html = buildReceiptHtml(makeReceipt({ customerDocument: "123", discount: 0.05 }));

    const order = ["ITENS", "TOTAL<", "FORMA DE PAGAMENTO", "CONSUMIDOR:"].map((marker) =>
      html.indexOf(marker),
    );

    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("dá ao cabeçalho das colunas um corpo menor que o do nome do produto", () => {
    // O cabeçalho já compartilhou a classe do nome do item e saía do mesmo
    // tamanho dele, competindo com o conteúdo.
    const html = buildReceiptHtml(makeReceipt());

    expect(html).toContain('class="row items-header"');
    expect(html).toContain(".row.items-header");
  });

  it("cai para não identificado sem documento", () => {
    expect(buildReceiptHtml(makeReceipt())).toContain("CONSUMIDOR: Não identificado");
    expect(buildReceiptHtml(makeReceipt({ customerDocument: "   " }))).toContain(
      "CONSUMIDOR: Não identificado",
    );
  });

  it("omite subtotal e desconto quando não há desconto", () => {
    const html = buildReceiptHtml(makeReceipt());

    expect(html).not.toContain("Subtotal");
    expect(html).not.toContain("Desconto");
  });

  it("mostra subtotal e desconto quando houve desconto", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CHICLETE DE BOLA", quantity: 10, unitPrice: 0.25 }],
        discount: 0.5,
        total: 2,
      }),
    );

    expect(html).toContain("Subtotal");
    expect(html).toContain("Desconto");
  });

  it("imprime troco só quando houve dinheiro recebido", () => {
    expect(buildReceiptHtml(makeReceipt())).not.toContain("Troco");
    expect(
      buildReceiptHtml(makeReceipt({ amountReceived: 5, change: 4.75 })),
    ).toContain("Troco");
  });

  it("carimba segunda via na reimpressão", () => {
    expect(buildReceiptHtml(makeReceipt())).not.toContain("SEGUNDA VIA");
    expect(buildReceiptHtml(makeReceipt({ reprint: true }))).toContain("SEGUNDA VIA");
  });

  it("carimba venda cancelada", () => {
    expect(buildReceiptHtml(makeReceipt({ cancelled: true }))).toContain("VENDA CANCELADA");
  });

  it("carimba a venda registrada sem conexão", () => {
    expect(buildReceiptHtml(makeReceipt())).not.toContain("VENDA OFFLINE");
    expect(buildReceiptHtml(makeReceipt({ offline: true }))).toContain("VENDA OFFLINE");
  });

  it("aceita número de cupom provisório na venda offline", () => {
    // A venda que ficou na fila ainda não tem ID no banco.
    const html = buildReceiptHtml(makeReceipt({ saleId: "OFF-14", offline: true }));

    expect(html).toContain("Cupom: OFF-14");
  });

  it("imprime a versão preta da logo, e não a arte colorida", () => {
    // Impressora térmica converte cor em meio-tom, e o laranja da marca saía
    // quase apagado no papel. Reembutir a arte original derruba este teste.
    // Caminho a partir do cwd, que é a raiz do pacote: sob jsdom o
    // `import.meta.url` não é uma URL de arquivo e não serve para ler do disco.
    const printArt = readFileSync(
      resolve(process.cwd(), "assets/logo-uaus-print.png"),
    ).toString("base64");

    expect(STORE_LOGO_DATA_URI).toBe(`data:image/png;base64,${printArt}`);
    expect(buildReceiptHtml(makeReceipt())).toContain(STORE_LOGO_DATA_URI);
  });

  it("imprime o número do cupom e o operador", () => {
    const html = buildReceiptHtml(makeReceipt());

    expect(html).toContain("Cupom: 142291");
    expect(html).toContain("Operador: Eduardo Henrique");
  });

  it("omite a linha do operador quando ele não é conhecido", () => {
    expect(buildReceiptHtml(makeReceipt({ operatorName: null }))).not.toContain("Operador:");
  });

  it("escapa o texto vindo do cadastro", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "<script>alert(1)</script>", quantity: 1, unitPrice: 1 }],
      }),
    );

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("marca o pagamento parcelado", () => {
    const html = buildReceiptHtml(
      makeReceipt({ payments: [{ name: "Cartão de Crédito", amount: 0.25, installments: 3 }] }),
    );

    expect(html).toContain("Cartão de Crédito (3x)");
  });

  it("mostra traço quando a origem não informou o valor da forma de pagamento", () => {
    const html = buildReceiptHtml(makeReceipt({ payments: [{ name: "Dinheiro", amount: null }] }));

    expect(html).toContain("<span class=\"row-value\">—</span>");
  });
});
