import { describe, expect, it } from "vitest";
import { buildReceiptFromSale, type SaleLike } from "./from-sale";

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
    const receipt = buildReceiptFromSale(
      makeSale({ discount: 2, notes: "entrega" }),
      [{ productId: 7, productName: "CHICLETE", quantity: 2, unitPrice: 6 }],
    );

    expect(receipt.saleId).toBe(42);
    expect(receipt.total).toBe(10);
    expect(receipt.discount).toBe(2);
    expect(receipt.notes).toBe("entrega");
    // O item da venda da API não carrega código de barras, então ele fica nulo
    // e a linha do código não é impressa.
    expect(receipt.items).toEqual([
      { name: "CHICLETE", quantity: 2, unitPrice: 6, barcode: null },
    ]);
  });

  it("repassa o código de barras quando a origem o conhece", () => {
    const receipt = buildReceiptFromSale(makeSale(), [
      { productId: 7, productName: "CHICLETE", quantity: 1, unitPrice: 6, barcode: "789123" },
    ]);

    expect(receipt.items[0].barcode).toBe("789123");
  });

  it("nomeia o produto pelo ID quando a API não trouxe a descrição", () => {
    const receipt = buildReceiptFromSale(makeSale(), [
      { productId: 7, quantity: 1, unitPrice: 10 },
    ]);

    expect(receipt.items[0].name).toBe("Produto #7");
  });

  it("resolve o nome da forma de pagamento pelo mapa quando a venda não traz", () => {
    const receipt = buildReceiptFromSale(
      makeSale({ payments: [{ paymentMethodId: 3, amount: 10 }] }),
      [],
      { paymentMethodNameById: { 3: "PIX" } },
    );

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
});
