import { describe, expect, it } from "vitest";
import { buildSaleReceipt } from "../build-sale-receipt";
import type { PdvItem, SavedSale } from "../../types";

const ITEM: PdvItem = {
  id: "linha-1",
  productId: 7,
  name: "Coca-Cola 350ml",
  barcode: "7891000100103",
  price: 10,
  quantity: 2,
  discount: 2,
  availableStock: 5,
};

const SAVED: SavedSale = {
  receiptNumber: 42,
  createdAt: "2026-08-15T12:00:00",
  total: 16,
  notes: null,
  customerDocument: null,
  offline: false,
};

/** Monta o cupom da venda de referência, com as sobrescritas do caso. */
function build(overrides: Partial<Parameters<typeof buildSaleReceipt>[0]> = {}) {
  return buildSaleReceipt({
    saved: SAVED,
    items: [ITEM],
    payments: [{ paymentMethodId: 1, amount: 16, installmentNumber: 1 }],
    paymentMethodNameById: { 1: "Dinheiro" },
    globalDiscount: 0,
    operatorName: "Ana",
    consumerDocument: "",
    receivedAmount: 20,
    change: 4,
    isReedition: false,
    companySettings: { usesCashRegister: true },
    ...overrides,
  });
}

describe("buildSaleReceipt", () => {
  it("deve imprimir o preço que o cliente pagou, não o de tabela", () => {
    const receipt = build();

    expect(receipt.items[0].unitPrice).toBe(8);
    expect(receipt.items[0].quantity).toBe(2);
    expect(receipt.total).toBe(16);
    expect(receipt.saleId).toBe(42);
  });

  it("deve nomear a forma de pagamento pelo mapa da tela", () => {
    const receipt = build();

    expect(receipt.payments[0].name).toBe("Dinheiro");
  });

  it("deve chamar de não informada a forma que não está no mapa", () => {
    const receipt = build({ paymentMethodNameById: {} });

    expect(receipt.payments[0].name).toBe("Não informado");
  });

  it("deve usar o documento digitado no balcão quando a venda não devolveu um", () => {
    const receipt = build({ consumerDocument: "  123.456.789-00  " });

    expect(receipt.customerDocument).toBe("123.456.789-00");
  });

  it("deve preferir o documento que veio da venda gravada", () => {
    const receipt = build({
      saved: { ...SAVED, customerDocument: "98.765.432/0001-10" },
      consumerDocument: "123.456.789-00",
    });

    expect(receipt.customerDocument).toBe("98.765.432/0001-10");
  });

  it("não deve imprimir troco quando não houve dinheiro em espécie", () => {
    const receipt = build({ receivedAmount: null, change: 0 });

    // Zero seria lido como "recebi o valor exato", que é outra informação.
    expect(receipt.change).toBeNull();
    expect(receipt.amountReceived).toBeNull();
  });

  it("deve carimbar segunda via na reedição e provisório na venda offline", () => {
    expect(build({ isReedition: true }).reprint).toBe(true);
    expect(build({ saved: { ...SAVED, offline: true, receiptNumber: "OFF-3" } }).offline).toBe(true);
  });
});
