import { describe, expect, it } from "vitest";
import { COUPON_DISCOUNT_TYPE } from "@workspace/api-client-react";
import { buildReceiptFromSale, formatReceiptCurrency } from "@workspace/receipt";
import { buildSaleReceipt } from "../build-sale-receipt";
import type { AppliedCoupon, PdvItem, SavedSale } from "../../types";

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

/** Cupom de 10% do panfleto de setembro. */
const CUPOM_10: AppliedCoupon = {
  couponId: 7,
  code: "10OFFSET26",
  description: "Panfleto de setembro",
  discountType: COUPON_DISCOUNT_TYPE.Percentage,
  discountValue: 10,
  answers: [],
};

/** Cupom de R$ 20,00 fixos — maior que a venda de referência. */
const CUPOM_20: AppliedCoupon = {
  couponId: 8,
  code: "BEMVINDO",
  description: null,
  discountType: COUPON_DISCOUNT_TYPE.Amount,
  discountValue: 20,
  answers: [],
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

  it("não deve imprimir bloco de cupom na venda sem cupom", () => {
    // Ausente é a decisão: presente, o cupom ganha linha própria no impresso.
    expect(build().coupon).toBeUndefined();
  });

  it("deve imprimir o cupom com o parâmetro do panfleto e o valor derivado", () => {
    const receipt = build({ globalDiscount: 0, coupon: CUPOM_10 });

    // 10% de R$ 16,00 (2 x R$ 8,00, já líquidos do desconto de linha).
    expect(receipt.coupon).toEqual({
      code: "10OFFSET26",
      description: "Panfleto de setembro",
      label: "10%",
      amount: 1.6,
    });
  });

  it("deve imprimir o cupom de valor fixo em reais", () => {
    const receipt = build({ coupon: CUPOM_20 });

    // "R$ 20,00" e não "20%": o rótulo é o que estava no papel do cliente.
    expect(receipt.coupon?.label).toBe(formatReceiptCurrency(20));
    // Cupom maior que a venda zera o total, e o abatido é só o que havia a abater.
    expect(receipt.coupon?.amount).toBe(16);
    // Venda zerada não teve recebimento: a forma que estava selecionada no
    // checkout não pode aparecer no papel com R$ 0,00.
    expect(receipt.payments).toEqual([]);
  });

  it("deve tirar o cupom da linha de desconto, para o abatimento não sair em dobro", () => {
    const receipt = build({ globalDiscount: 4, coupon: CUPOM_10 });

    // Subtotal 16,00 − 4,00 do operador = 12,00; 10% disso é 1,20.
    expect(receipt.discount).toBe(4);
    expect(receipt.coupon?.amount).toBe(1.2);
  });

  it("deve produzir a mesma linha que a reimpressão a partir da venda gravada", () => {
    const doCarrinho = build({ globalDiscount: 4, coupon: CUPOM_10 });

    // A segunda via nasce do snapshot que a venda carrega, por outro caminho de
    // código. Sair diferente da primeira via é pior que não reimprimir.
    const reimpressao = buildReceiptFromSale(
      {
        id: 42,
        createdAt: "2026-08-15T12:00:00",
        total: 10.8,
        discount: 5.2,
        couponDiscount: 1.2,
        couponCode: "10OFFSET26",
        couponDescription: "Panfleto de setembro",
        couponDiscountType: "Percentage",
        couponDiscountValue: 10,
        paymentStatus: 1,
        notes: null,
      },
      [],
    );

    expect(doCarrinho.coupon).toEqual(reimpressao.coupon);
    expect(doCarrinho.discount).toBe(reimpressao.discount);
  });
});
