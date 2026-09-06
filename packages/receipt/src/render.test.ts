import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReceiptHtml, computeItemsSubtotal, formatReceiptCurrency } from "./render";
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
    expect(buildReceiptHtml(makeReceipt())).not.toContain('item-barcode">');
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

  it("omite subtotal e desconto quando não há abatimento nenhum", () => {
    // Sem desconto e sem cupom o cupom não fala em desconto de forma alguma —
    // nem em "Desconto", nem em "DESCONTO CUPOM".
    const html = buildReceiptHtml(makeReceipt());

    expect(html).not.toContain("Subtotal");
    expect(html).not.toMatch(/desconto/i);
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

  it("imprime a linha do cupom com código, parâmetro e valor abatido", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CHICLETE DE BOLA", quantity: 10, unitPrice: 12.34 }],
        discount: 0,
        coupon: { code: "10OFFSET26", label: "10%", amount: 12.34 },
        total: 111.06,
      }),
    );

    expect(html).toContain("DESCONTO CUPOM 10OFFSET26 (10%)");
    expect(html).toContain(`- ${formatReceiptCurrency(12.34)}`);
  });

  it("imprime o cupom de valor fixo com o rótulo em reais", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CESTA", quantity: 1, unitPrice: 100 }],
        coupon: { code: "BEMVINDO", label: formatReceiptCurrency(20), amount: 20 },
        total: 80,
      }),
    );

    expect(html).toContain(`DESCONTO CUPOM BEMVINDO (${formatReceiptCurrency(20)})`);
  });

  it("imprime o Subtotal na venda abatida SÓ pelo cupom", () => {
    // Sem esta regra o papel mostraria um abatimento pendurado, sem o valor
    // cheio acima dele para ser subtraído.
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CESTA", quantity: 1, unitPrice: 100 }],
        discount: 0,
        coupon: { code: "BEMVINDO", label: "20%", amount: 20 },
        total: 80,
      }),
    );

    expect(html).toContain("Subtotal");
    expect(html).toContain(formatReceiptCurrency(100));
    // Sem desconto de operador, a linha "Desconto" continua fora.
    expect(html).not.toContain(">Desconto<");
  });

  it("põe a linha do cupom entre o desconto e o TOTAL", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CESTA", quantity: 1, unitPrice: 100 }],
        discount: 5,
        coupon: { code: "BEMVINDO", label: "10%", amount: 9.5 },
        total: 85.5,
      }),
    );

    // `class="row total"` e não "TOTAL": a palavra também é o cabeçalho da
    // coluna dos itens, lá em cima, e o indexOf pararia nela.
    const order = ["Subtotal", ">Desconto<", "DESCONTO CUPOM", 'class="row total"'].map((marker) =>
      html.indexOf(marker),
    );

    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("imprime a descrição do cupom abaixo da linha do abatimento", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        coupon: {
          code: "BEMVINDO",
          description: "Primeira compra",
          label: "10%",
          amount: 0.02,
        },
      }),
    );

    expect(html).toContain('<div class="item-breakdown">Primeira compra</div>');
    expect(html.indexOf("DESCONTO CUPOM")).toBeLessThan(html.indexOf("Primeira compra"));
  });

  it("escapa o código e a descrição do cupom", () => {
    // `row()` interpola cru: quem escapa é quem monta o rótulo. Código vem de
    // campo livre do cadastro e já chegou torto de importação de planilha.
    const html = buildReceiptHtml(
      makeReceipt({
        coupon: {
          code: '<b>10"OFF</b>',
          description: '<img src="x">',
          label: "10%",
          amount: 0.02,
        },
      }),
    );

    expect(html).not.toContain("<b>10");
    expect(html).not.toContain('<img src="x">');
    expect(html).toContain("&lt;b&gt;10&quot;OFF&lt;/b&gt;");
    expect(html).toContain("&lt;img src=&quot;x&quot;&gt;");
  });

  it("omite os parênteses quando o cupom não sabe o próprio parâmetro", () => {
    // Snapshot antigo, sem tipo nem valor: sai o código sozinho, e não "(0%)".
    const html = buildReceiptHtml(makeReceipt({ coupon: { code: "ANTIGO", label: "", amount: 0.02 } }));

    expect(html).toContain("DESCONTO CUPOM ANTIGO<");
    expect(html).not.toContain("ANTIGO (");
  });

  it("imprime a venda zerada pelo cupom sem troco e sem pagamento", () => {
    // O cupom pode zerar a venda (nunca torná-la negativa) e o checkout do PDV
    // pula a etapa de pagamento — o comprovante ainda tem que sair inteiro.
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "BRINDE", quantity: 1, unitPrice: 20 }],
        payments: [],
        discount: 0,
        coupon: { code: "GRATIS", label: "100%", amount: 20 },
        total: 0,
      }),
    );

    expect(html).toContain(`>TOTAL</span><span class="row-value">${formatReceiptCurrency(0)}<`);
    expect(html).not.toContain("Troco");
    expect(html).not.toContain("Valor recebido");
    expect(html).toContain("Nenhum pagamento registrado.");
  });

  it("imprime troco só quando houve dinheiro recebido", () => {
    expect(buildReceiptHtml(makeReceipt())).not.toContain("Troco");
    expect(buildReceiptHtml(makeReceipt({ amountReceived: 5, change: 4.75 }))).toContain("Troco");
  });

  it("carimba segunda via na reimpressão", () => {
    expect(buildReceiptHtml(makeReceipt())).not.toContain("SEGUNDA VIA");
    expect(buildReceiptHtml(makeReceipt({ reprint: true }))).toContain("SEGUNDA VIA");
  });

  it("carimba venda cancelada", () => {
    expect(buildReceiptHtml(makeReceipt({ cancelled: true }))).toContain("VENDA CANCELADA");
  });

  it("imprime itens em cupom de venda cancelada com segunda via", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        cancelled: true,
        reprint: true,
        items: [{ name: "CAMISA POLO", quantity: 2, unitPrice: 49.9 }],
        total: 99.8,
        notes: "Cancelada no PDV",
      }),
    );

    expect(html).toContain("VENDA CANCELADA");
    expect(html).toContain("SEGUNDA VIA");
    expect(html).toContain("CAMISA POLO");
    expect(html).toContain("2 UN x");
    expect(html).toContain("Cancelada no PDV");
    expect(html).not.toContain("Cancelamento: Cancelada");
  });

  it("sanitiza redundância histórica em observação de cancelamento", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        notes: "Cancelamento: Cancelada no PDV",
      }),
    );

    expect(html).toContain("<strong>Obs.:</strong> Cancelada no PDV");
    expect(html).not.toContain("Cancelamento: Cancelada");
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
    const printArt = readFileSync(resolve(process.cwd(), "assets/logo-uaus-print.png")).toString("base64");

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

    expect(html).toContain('<span class="row-value">—</span>');
  });

  it("imprime o preço de tabela e a linha de desconto do item quando houve desconto", () => {
    // Venda #1945 de dev: carregador de R$ 22,00 vendido a R$ 20,00. O cupom
    // saía "1 UN x R$ 20,00" sem nenhuma menção ao desconto — como se o
    // produto custasse R$ 20,00.
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "CARREGADOR CELULAR IPHONE", quantity: 1, unitPrice: 20, unitDiscount: 2 }],
        payments: [{ name: "Dinheiro", amount: 20 }],
        total: 20,
      }),
    );

    expect(html).toContain(`1 UN x ${formatReceiptCurrency(22)}`);
    expect(html).toContain(
      `<div class="row item-discount"><span class="row-label">Desconto</span><span class="row-value">- ${formatReceiptCurrency(2)}</span></div>`,
    );
    // O total da linha continua sendo o que o cliente pagou.
    expect(html).toContain(`<span class="row-value">${formatReceiptCurrency(20)}</span>`);
  });

  it("multiplica o desconto unitário pela quantidade na linha do item", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [{ name: "COCA-COLA 350ML", quantity: 3, unitPrice: 8, unitDiscount: 2 }],
        payments: [{ name: "Dinheiro", amount: 24 }],
        total: 24,
      }),
    );

    expect(html).toContain(`3 UN x ${formatReceiptCurrency(10)}`);
    expect(html).toContain(`- ${formatReceiptCurrency(6)}`);
  });

  it("não imprime linha de desconto no item sem desconto", () => {
    const html = buildReceiptHtml(
      makeReceipt({ items: [{ name: "CHICLETE", quantity: 2, unitPrice: 0.25, unitDiscount: 0 }] }),
    );

    expect(html).not.toContain('class="row item-discount"');
    expect(html).toContain(`2 UN x ${formatReceiptCurrency(0.25)}`);
  });

  it("não deixa desconto de item negativo virar acréscimo", () => {
    const html = buildReceiptHtml(
      makeReceipt({ items: [{ name: "CHICLETE", quantity: 1, unitPrice: 0.25, unitDiscount: -1 }] }),
    );

    expect(html).not.toContain('class="row item-discount"');
    expect(html).toContain(`1 UN x ${formatReceiptCurrency(0.25)}`);
  });

  it("imprime o preço do produto, o acréscimo e a justificativa quando houve acréscimo", () => {
    // Pendrive de R$ 25,00 de tabela vendido a R$ 30,00 por causa da gravação.
    // Sem tirar o acréscimo da linha da quantidade, o cupom diria que a tabela
    // do pendrive é R$ 30,00 — e o cliente não teria de onde ver os R$ 5,00.
    const html = buildReceiptHtml(
      makeReceipt({
        items: [
          {
            name: "MINI PENDRIVE USB 16GB",
            quantity: 1,
            unitPrice: 30,
            unitSurcharge: 5,
            surchargeReason: "Gravação de músicas",
          },
        ],
        payments: [{ name: "Dinheiro", amount: 30 }],
        total: 30,
      }),
    );

    expect(html).toContain(`1 UN x ${formatReceiptCurrency(25)}`);
    expect(html).toContain(
      `<div class="row item-surcharge"><span class="row-label">Acréscimo</span><span class="row-value">+ ${formatReceiptCurrency(5)}</span></div>`,
    );
    expect(html).toContain('<div class="item-surcharge-reason">Gravação de músicas</div>');
    // O total da linha continua sendo o que o cliente pagou.
    expect(html).toContain(`<span class="row-value">${formatReceiptCurrency(30)}</span>`);
  });

  it("multiplica o acréscimo unitário pela quantidade na linha do item", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        items: [
          {
            name: "MINI PENDRIVE USB 16GB",
            quantity: 2,
            unitPrice: 30,
            unitSurcharge: 5,
            surchargeReason: "Gravação de músicas",
          },
        ],
        payments: [{ name: "Dinheiro", amount: 60 }],
        total: 60,
      }),
    );

    expect(html).toContain(`2 UN x ${formatReceiptCurrency(25)}`);
    expect(html).toContain(`+ ${formatReceiptCurrency(10)}`);
  });

  it("imprime acréscimo e desconto na mesma linha de item, nessa ordem", () => {
    // Tabela R$ 25,00 + R$ 5,00 de gravação − R$ 2,00 de desconto = R$ 28,00.
    // A ordem importa: é lendo de cima para baixo que a coluna da direita fecha.
    const html = buildReceiptHtml(
      makeReceipt({
        items: [
          {
            name: "MINI PENDRIVE USB 16GB",
            quantity: 1,
            unitPrice: 28,
            unitDiscount: 2,
            unitSurcharge: 5,
            surchargeReason: "Gravação de músicas",
          },
        ],
        payments: [{ name: "Dinheiro", amount: 28 }],
        total: 28,
      }),
    );

    expect(html).toContain(`1 UN x ${formatReceiptCurrency(25)}`);
    // As linhas RENDERIZADAS, e não a classe: o CSS também cita as duas, e lá
    // elas aparecem na ordem em que a folha de estilo as declara.
    expect(html.indexOf('<div class="row item-surcharge">')).toBeLessThan(
      html.indexOf('<div class="row item-discount">'),
    );
    expect(html).toContain(`+ ${formatReceiptCurrency(5)}`);
    expect(html).toContain(`- ${formatReceiptCurrency(2)}`);
  });

  it("não imprime linha de acréscimo no item sem acréscimo", () => {
    const html = buildReceiptHtml(
      makeReceipt({ items: [{ name: "CHICLETE", quantity: 2, unitPrice: 0.25 }] }),
    );

    expect(html).not.toContain('class="row item-surcharge"');
    expect(html).toContain(`2 UN x ${formatReceiptCurrency(0.25)}`);
  });

  it("não deixa acréscimo negativo virar desconto", () => {
    const html = buildReceiptHtml(
      makeReceipt({ items: [{ name: "CHICLETE", quantity: 1, unitPrice: 0.25, unitSurcharge: -1 }] }),
    );

    expect(html).not.toContain('class="row item-surcharge"');
    expect(html).toContain(`1 UN x ${formatReceiptCurrency(0.25)}`);
  });
});
