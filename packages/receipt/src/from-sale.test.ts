import { describe, expect, it } from "vitest";
import { buildReceiptFromSale, type SaleLike } from "./from-sale";
import { buildReceiptHtml, formatReceiptCurrency } from "./render";
import type { ReceiptData } from "./types";

/**
 * Extrai o bloco de totais do cupom já impresso — "rótulo valor", na ordem.
 *
 * A comparação é feita sobre o HTML e não sobre o `ReceiptData` de propósito: o
 * que precisa bater entre a primeira e a segunda via é o que sai no papel.
 */
function totalsBlock(html: string): string[] {
  const rows = html.matchAll(
    /<div class="row[^"]*"><span class="row-label">(.*?)<\/span><span class="row-value">(.*?)<\/span><\/div>/g,
  );

  return [...rows]
    .filter(([, label]) => /^(Subtotal|Desconto|DESCONTO CUPOM|TOTAL$)/.test(label))
    .map(([, label, value]) => `${label} ${value}`);
}

/**
 * Texto do bloco de itens do cupom impresso — da seção ITENS até o TOTAL —
 * sem a marcação. A comparação é sobre o HTML pelo mesmo motivo de
 * `totalsBlock`: o que tem que bater entre as duas vias é o que sai no papel.
 *
 * O espaço em branco é normalizado sem `\s`, que engoliria o espaço
 * inseparável do "R$ 22,00" e faria a comparação com `formatReceiptCurrency`
 * falhar por um caractere invisível.
 */
function itemsBlock(html: string): string {
  const start = html.indexOf("ITENS</div>");
  const end = html.indexOf('<div class="row total">');

  return html
    .slice(start, end)
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

/** Venda mínima como a API devolve, sobrescrita por teste conforme o caso. */
function makeSale(overrides: Partial<SaleLike> = {}): SaleLike {
  return {
    id: 42,
    createdAt: "2026-07-25T12:30:15",
    total: 10,
    discount: 0,
    notes: null,
    payments: [{ paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: 10 }],
    ...overrides,
  };
}

describe("buildReceiptFromSale", () => {
  it("copia os dados da venda para o cupom", () => {
    const receipt = buildReceiptFromSale(makeSale({ discount: 2, notes: "entrega" }), [
      { productId: 7, productName: "CHICLETE", quantity: 2, unitPrice: 6 },
    ]);

    expect(receipt.saleId).toBe(42);
    expect(receipt.total).toBe(10);
    expect(receipt.discount).toBe(2);
    expect(receipt.notes).toBe("entrega");
    // O item da venda da API não carrega código de barras, então ele fica nulo
    // e a linha do código não é impressa.
    expect(receipt.items).toEqual([
      {
        name: "CHICLETE",
        quantity: 2,
        unitPrice: 6,
        unitDiscount: 0,
        unitSurcharge: 0,
        surchargeReason: null,
        barcode: null,
      },
    ]);
  });

  it("repassa o código de barras quando a origem o conhece", () => {
    const receipt = buildReceiptFromSale(makeSale(), [
      { productId: 7, productName: "CHICLETE", quantity: 1, unitPrice: 6, barcode: "789123" },
    ]);

    expect(receipt.items[0].barcode).toBe("789123");
  });

  it("nomeia o produto pelo ID quando a API não trouxe a descrição", () => {
    const receipt = buildReceiptFromSale(makeSale(), [{ productId: 7, quantity: 1, unitPrice: 10 }]);

    expect(receipt.items[0].name).toBe("Produto #7");
  });

  it("resolve o nome da forma de pagamento pelo mapa quando a venda não traz", () => {
    const receipt = buildReceiptFromSale(makeSale({ payments: [{ paymentMethodId: 3, amount: 10 }] }), [], {
      paymentMethodNameById: { 3: "PIX" },
    });

    expect(receipt.payments[0].name).toBe("PIX");
  });

  it("cai para a forma única da venda quando não há coleção de pagamentos", () => {
    const receipt = buildReceiptFromSale(
      makeSale({ payments: [], paymentMethodName: "Débito", installments: 1 }),
      [],
    );

    expect(receipt.payments).toEqual([{ name: "Débito", amount: 10, installments: 1 }]);
  });

  it("assume forma não informada em venda antiga sem nenhum pagamento", () => {
    const receipt = buildReceiptFromSale(makeSale({ payments: null }), []);

    expect(receipt.payments[0].name).toBe("Não informado");
    expect(receipt.payments[0].amount).toBe(10);
  });

  it("usa o consumidor e o operador que a própria venda já traz", () => {
    const receipt = buildReceiptFromSale(
      makeSale({
        customerDocument: "123.456.789-00",
        userName: "Eduardo Henrique",
      }),
      [],
    );

    expect(receipt.customerDocument).toBe("123.456.789-00");
    expect(receipt.operatorName).toBe("Eduardo Henrique");
  });

  it("deixa o contexto sobrescrever o que veio na venda", () => {
    const receipt = buildReceiptFromSale(makeSale({ userName: "Da venda" }), [], {
      operatorName: "Do contexto",
    });

    expect(receipt.operatorName).toBe("Do contexto");
  });

  it("não inventa bloco de cupom na venda que não teve um", () => {
    const receipt = buildReceiptFromSale(makeSale({ discount: 2 }), []);

    expect(receipt.coupon).toBeUndefined();
    expect(receipt.discount).toBe(2);
  });

  it("monta o bloco do cupom a partir do snapshot da venda", () => {
    const receipt = buildReceiptFromSale(
      makeSale({
        discount: 12.34,
        couponDiscount: 12.34,
        couponCode: "10OFFSET26",
        couponDescription: "Panfleto de setembro",
        couponDiscountType: "Percentage",
        couponDiscountValue: 10,
      }),
      [],
    );

    expect(receipt.coupon).toEqual({
      code: "10OFFSET26",
      description: "Panfleto de setembro",
      label: "10%",
      amount: 12.34,
    });
  });

  it("escreve o rótulo em reais no cupom de valor fixo", () => {
    const receipt = buildReceiptFromSale(
      makeSale({
        couponCode: "BEMVINDO",
        couponDiscountType: "Amount",
        couponDiscountValue: 20,
        couponDiscount: 20,
        discount: 20,
      }),
      [],
    );

    expect(receipt.coupon?.label).toBe(formatReceiptCurrency(20));
  });

  it("aceita o tipo do desconto como número, e não só como nome", () => {
    // A fila offline pode ter guardado o código do enum em vez do nome.
    const receipt = buildReceiptFromSale(
      makeSale({ couponCode: "X", couponDiscountType: 1, couponDiscountValue: 15 }),
      [],
    );

    expect(receipt.coupon?.label).toBe("15%");
  });

  it("deixa o rótulo vazio quando o snapshot não sabe tipo nem valor", () => {
    const receipt = buildReceiptFromSale(makeSale({ couponCode: "ANTIGO" }), []);

    expect(receipt.coupon?.label).toBe("");
    expect(receipt.coupon?.amount).toBe(0);
  });

  it("tira o cupom do desconto, porque na API ele já está dentro dele", () => {
    // `discount` da API é o desconto TOTAL: 5 do operador + 11,84 do cupom.
    // Repassá-lo cru imprimiria o cupom duas vezes e a coluna não fecharia.
    const receipt = buildReceiptFromSale(
      makeSale({ discount: 16.84, couponDiscount: 11.84, couponCode: "10OFFSET26" }),
      [],
    );

    expect(receipt.discount).toBe(5);
    expect(receipt.coupon?.amount).toBe(11.84);
  });

  it("não deixa o desconto ficar negativo com snapshot inconsistente", () => {
    const receipt = buildReceiptFromSale(makeSale({ discount: 5, couponDiscount: 12, couponCode: "X" }), []);

    expect(receipt.discount).toBe(0);
  });

  it("reimprime o mesmo bloco de totais que saiu na primeira via", () => {
    // A primeira via nasce do carrinho do PDV, com os descontos já
    // discriminados; a segunda nasce da venda da API, onde eles vêm somados.
    // Divergir aqui é pior do que não reimprimir: o cliente tem as duas vias.
    const items = [{ productId: 7, productName: "CESTA", quantity: 1, unitPrice: 123.4 }];

    const firstVia: ReceiptData = {
      saleId: 42,
      createdAt: "2026-09-30T12:30:15",
      items: [{ name: "CESTA", quantity: 1, unitPrice: 123.4 }],
      payments: [{ name: "Dinheiro", amount: 106.56 }],
      discount: 5,
      coupon: { code: "10OFFSET26", description: null, label: "10%", amount: 11.84 },
      total: 106.56,
    };

    const secondVia = buildReceiptFromSale(
      makeSale({
        createdAt: "2026-09-30T12:30:15",
        total: 106.56,
        discount: 16.84,
        couponDiscount: 11.84,
        couponCode: "10OFFSET26",
        couponDiscountType: "Percentage",
        couponDiscountValue: 10,
        payments: [{ paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: 106.56 }],
      }),
      items,
      { reprint: true },
    );

    const printed = totalsBlock(buildReceiptHtml(secondVia));

    expect(printed).toEqual(totalsBlock(buildReceiptHtml(firstVia)));
    expect(printed).toEqual([
      `Subtotal ${formatReceiptCurrency(123.4)}`,
      `Desconto - ${formatReceiptCurrency(5)}`,
      `DESCONTO CUPOM 10OFFSET26 (10%) - ${formatReceiptCurrency(11.84)}`,
      `TOTAL ${formatReceiptCurrency(106.56)}`,
    ]);
  });

  it("repassa o contexto de operador, consumidor e segunda via", () => {
    const receipt = buildReceiptFromSale(makeSale(), [], {
      operatorName: "Eduardo",
      customerDocument: "987.654.321-00",
      reprint: true,
      cancelled: true,
    });

    expect(receipt.operatorName).toBe("Eduardo");
    expect(receipt.customerDocument).toBe("987.654.321-00");
    expect(receipt.reprint).toBe(true);
    expect(receipt.cancelled).toBe(true);
  });

  it("repassa o desconto unitário do item para a linha do cupom", () => {
    // É o dado que a reimpressão perdia: a API grava unitPrice líquido e o
    // desconto à parte, e o cupom só lia o primeiro.
    const receipt = buildReceiptFromSale(makeSale({ total: 20 }), [
      { productId: 163, productName: "CARREGADOR CELULAR IPHONE", quantity: 1, unitPrice: 20, discount: 2 },
    ]);

    expect(receipt.items[0]).toEqual({
      name: "CARREGADOR CELULAR IPHONE",
      quantity: 1,
      unitPrice: 20,
      unitDiscount: 2,
      unitSurcharge: 0,
      surchargeReason: null,
      barcode: null,
    });
  });

  it("repassa o acréscimo do item e a justificativa para a linha do cupom", () => {
    // Sem isso a segunda via mostraria o pendrive como se a tabela dele fosse o
    // preço com a gravação embutida — e é a segunda via que o cliente traz de
    // volta ao balcão para reclamar.
    const receipt = buildReceiptFromSale(makeSale({ total: 30 }), [
      {
        productId: 1023,
        productName: "MINI PENDRIVE USB 16GB",
        quantity: 1,
        unitPrice: 30,
        surcharge: 5,
        surchargeReason: "Gravação de músicas",
      },
    ]);

    expect(receipt.items[0]).toEqual({
      name: "MINI PENDRIVE USB 16GB",
      quantity: 1,
      unitPrice: 30,
      unitDiscount: 0,
      unitSurcharge: 5,
      surchargeReason: "Gravação de músicas",
      barcode: null,
    });
  });

  it("trata acréscimo de item ausente ou negativo como zero", () => {
    const receipt = buildReceiptFromSale(makeSale(), [
      { productId: 7, productName: "CHICLETE", quantity: 1, unitPrice: 6 },
      { productId: 8, productName: "BALA", quantity: 1, unitPrice: 4, surcharge: -3 },
    ]);

    expect(receipt.items[0].unitSurcharge).toBe(0);
    expect(receipt.items[1].unitSurcharge).toBe(0);
  });

  it("trata desconto de item ausente ou negativo como zero", () => {
    const receipt = buildReceiptFromSale(makeSale(), [
      { productId: 1, quantity: 1, unitPrice: 5 },
      { productId: 2, quantity: 1, unitPrice: 5, discount: null },
      { productId: 3, quantity: 1, unitPrice: 5, discount: -1 },
    ]);

    expect(receipt.items.map((item) => item.unitDiscount)).toEqual([0, 0, 0]);
  });

  it("reimprime a mesma linha de item que saiu na primeira via quando houve desconto de item", () => {
    // A primeira via nasce do carrinho (preço de tabela e desconto separados);
    // a segunda nasce da venda da API (preço líquido e desconto separados). As
    // duas têm que imprimir "1 UN x R$ 22,00" e "Desconto - R$ 2,00" — é a
    // venda #1945 de dev, cuja segunda via saía sem o desconto.
    const firstVia: ReceiptData = {
      saleId: 1945,
      createdAt: "2026-09-02T08:52:54",
      items: [{ name: "CARREGADOR CELULAR IPHONE", quantity: 1, unitPrice: 20, unitDiscount: 2 }],
      payments: [{ name: "Dinheiro", amount: 20 }],
      discount: 0,
      total: 20,
    };

    const secondVia = buildReceiptFromSale(
      makeSale({
        id: 1945,
        createdAt: "2026-09-02T08:52:54",
        total: 20,
        payments: [{ paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: 20 }],
      }),
      [{ productId: 163, productName: "CARREGADOR CELULAR IPHONE", quantity: 1, unitPrice: 20, discount: 2 }],
      { reprint: true },
    );

    const printed = itemsBlock(buildReceiptHtml(secondVia));

    expect(printed).toEqual(itemsBlock(buildReceiptHtml(firstVia)));
    expect(printed).toContain(`1 UN x ${formatReceiptCurrency(22)}`);
    expect(printed).toContain(`Desconto - ${formatReceiptCurrency(2)}`);
  });
});
