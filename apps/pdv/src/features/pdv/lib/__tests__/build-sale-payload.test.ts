import { describe, expect, it } from "vitest";
import { buildSalePayload } from "../build-sale-payload";
import type { PdvItem } from "../../types";

/** Cartão com taxa só na parcela ativa de 2x. */
const CARTAO = {
  id: 2,
  createdAt: "",
  updatedAt: null,
  name: "Cartão de Crédito",
  isActive: true,
  installments: [
    { id: 20, paymentMethodId: 2, installmentNumber: 1, feePercentage: 0, isActive: true },
    { id: 21, paymentMethodId: 2, installmentNumber: 2, feePercentage: 5, isActive: true },
    { id: 22, paymentMethodId: 2, installmentNumber: 3, feePercentage: 90, isActive: false },
  ],
};

/** Item de R$ 10,00 com R$ 2,00 de desconto por unidade, duas unidades. */
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

const CONSUMER = { customerId: null, name: "", document: "123.456.789-00" };

describe("buildSalePayload", () => {
  it("deve mandar o desconto separado do preço, para o preço de tabela ser reconstruível", () => {
    const payload = buildSalePayload({
      sessionId: 3,
      consumer: CONSUMER,
      globalDiscount: 1,
      items: [ITEM],
      payments: [{ paymentMethodId: 2, amount: 15, installmentNumber: 1 }],
      paymentMethods: [CARTAO],
      paymentMethodNameById: {},
    });

    expect(payload.items[0].unitPrice).toBe(8);
    expect(payload.items[0].discount).toBe(2);
    // O contrato do DTO: unitPrice + discount devolve o preço de tabela.
    expect(payload.items[0].unitPrice + payload.items[0].discount).toBe(ITEM.price);
    expect(payload.discount).toBe(1);
    expect(payload.cashRegisterSessionId).toBe(3);
    expect(payload.customerDocument).toBe(CONSUMER.document);
  });

  it("deve calcular a taxa pela parcela escolhida", () => {
    const payload = buildSalePayload({
      sessionId: 3,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [ITEM],
      payments: [{ paymentMethodId: 2, amount: 100, installmentNumber: 2 }],
      paymentMethods: [CARTAO],
      paymentMethodNameById: {},
    });

    expect(payload.payments[0].paymentMethodInstallmentId).toBe(21);
    expect(payload.payments[0].transactionFee).toBe(5);
    expect(payload.payments[0].installments).toBe(2);
  });

  it("não deve cobrar taxa de parcela inativa", () => {
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [ITEM],
      payments: [{ paymentMethodId: 2, amount: 100, installmentNumber: 3 }],
      paymentMethods: [CARTAO],
      paymentMethodNameById: {},
    });

    // A parcela de 3x está desativada: nem o vínculo nem a taxa dela entram.
    expect(payload.payments[0].paymentMethodInstallmentId).toBeNull();
    expect(payload.payments[0].transactionFee).toBe(0);
  });

  it("deve levar o nome da forma mesmo quando ela sumiu da lista em uso", () => {
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [ITEM],
      payments: [{ paymentMethodId: 9, amount: 50, installmentNumber: 1 }],
      paymentMethods: [CARTAO],
      paymentMethodNameById: { 9: "Pix" },
    });

    // Sem isso a fila offline subiria uma venda com forma de pagamento anônima.
    expect(payload.payments[0].paymentMethodName).toBe("Pix");
    expect(payload.items[0].productName).toBe(ITEM.name);
  });

  it("deve arredondar valores em duas casas", () => {
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [{ ...ITEM, price: 10.555, discount: 0 }],
      payments: [{ paymentMethodId: 2, amount: 33.333, installmentNumber: 2 }],
      paymentMethods: [CARTAO],
      paymentMethodNameById: {},
    });

    expect(payload.items[0].unitPrice).toBe(10.56);
    expect(payload.payments[0].amount).toBe(33.33);
    expect(payload.payments[0].transactionFee).toBe(1.67);
  });
});
