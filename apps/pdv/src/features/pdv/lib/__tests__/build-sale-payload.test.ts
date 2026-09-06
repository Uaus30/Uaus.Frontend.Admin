import { describe, expect, it } from "vitest";
import { COUPON_DISCOUNT_TYPE } from "@workspace/api-client-react";
import { computeSaleTotal } from "@/services/sales.service";
import { usePdvStore } from "@/stores/use-pdv-store";
import { buildSalePayload } from "../build-sale-payload";
import type { AppliedCoupon, PdvItem } from "../../types";

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

/** Item de R$ 30,00 sem desconto de linha, uma unidade. */
const ITEM_30: PdvItem = {
  id: "linha-2",
  productId: 9,
  name: "Vinho tinto",
  price: 30,
  quantity: 1,
  discount: 0,
  availableStock: 4,
};

/** Cupom de 10% do panfleto de setembro. */
const CUPOM_10: AppliedCoupon = {
  couponId: 7,
  code: "10OFFSET26",
  description: "Panfleto de setembro",
  discountType: COUPON_DISCOUNT_TYPE.Percentage,
  discountValue: 10,
  answers: [{ questionId: 3, optionId: 21 }],
};

/** Cupom de R$ 20,00 fixos. */
const CUPOM_20: AppliedCoupon = {
  couponId: 8,
  code: "BEMVINDO",
  description: null,
  discountType: COUPON_DISCOUNT_TYPE.Amount,
  discountValue: 20,
  answers: [],
};

/** Payload da venda de referência, com as sobrescritas do caso. */
function build(overrides: Partial<Parameters<typeof buildSalePayload>[0]> = {}) {
  return buildSalePayload({
    sessionId: 3,
    consumer: CONSUMER,
    globalDiscount: 0,
    items: [ITEM],
    payments: [{ paymentMethodId: 2, amount: 16, installmentNumber: 1 }],
    paymentMethods: [CARTAO],
    paymentMethodNameById: {},
    ...overrides,
  });
}

/**
 * Total que o carrinho está mostrando na tela, pelo store.
 *
 * O teste compara contra ELE, e não contra um número escrito à mão: o que não
 * pode divergir é a tela e o payload, e um literal no teste concordaria com os
 * dois lados errados ao mesmo tempo.
 */
function totalNaTela(items: PdvItem[], globalDiscount: number, coupon: AppliedCoupon | null) {
  usePdvStore.setState({ items, globalDiscount, coupon });
  return usePdvStore.getState().getTotal();
}

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

  it("não deve mandar bloco de cupom na venda sem cupom", () => {
    // `null` explícito, e não a chave ausente: o backend declara o bloco como
    // opcional e a fila offline antiga sobe exatamente assim.
    expect(build().coupon).toBeNull();
  });

  it("deve calcular o cupom sobre o que resta DEPOIS do desconto global", () => {
    // Subtotal 46,00 (2 x R$ 8,00 + R$ 30,00), menos R$ 5,00 de desconto manual:
    // o cupom de 10% incide sobre 41,00 e abate 4,10 — não 4,60 do subtotal cru.
    const payload = build({
      items: [ITEM, ITEM_30],
      globalDiscount: 5,
      coupon: CUPOM_10,
    });

    expect(payload.coupon?.baseAmount).toBe(41);
    expect(payload.coupon?.discountAmount).toBe(4.1);
    expect(payload.coupon?.couponId).toBe(CUPOM_10.couponId);
    expect(payload.coupon?.code).toBe("10OFFSET26");
    expect(payload.coupon?.discountType).toBe(COUPON_DISCOUNT_TYPE.Percentage);
    expect(payload.coupon?.answers).toEqual([{ questionId: 3, optionId: 21 }]);
  });

  it("deve levar o cupom DENTRO do desconto, nunca somado por fora", () => {
    const payload = build({ items: [ITEM, ITEM_30], globalDiscount: 5, coupon: CUPOM_10 });

    // 5,00 do operador + 4,10 do cupom. Manter o cupom fora inflaria o lucro em
    // todo relatório; somá-lo de novo recusaria a venda por total divergente.
    expect(payload.discount).toBe(9.1);
    expect(payload.discount).toBeGreaterThanOrEqual(payload.coupon?.discountAmount ?? 0);
  });

  it("deve gravar o mesmo total que o carrinho exibe", () => {
    const payload = build({ items: [ITEM, ITEM_30], globalDiscount: 5, coupon: CUPOM_10 });

    // O bug que já aconteceu com o desconto global: a tela mostrava um número e
    // o payload levava outro. `registerSale` calcula o total a partir daqui.
    expect(computeSaleTotal(payload.items, payload.discount)).toBe(totalNaTela([ITEM, ITEM_30], 5, CUPOM_10));
  });

  it("deve reajustar o cupom quando um item é bipado depois de aplicá-lo", () => {
    const antes = build({ items: [ITEM], coupon: CUPOM_10 });
    const depois = build({ items: [ITEM, ITEM_30], coupon: CUPOM_10 });

    // 10% de 16,00 e depois 10% de 46,00. Guardar o valor em reais no store
    // deixaria os dois em 1,60 e o servidor recusaria a segunda venda.
    expect(antes.coupon?.discountAmount).toBe(1.6);
    expect(depois.coupon?.discountAmount).toBe(4.6);
  });

  it("deve zerar a venda e mandar pagamentos vazios quando o cupom cobre tudo", () => {
    const payload = build({ items: [ITEM], coupon: CUPOM_20 });

    // Cupom de R$ 20,00 numa venda de R$ 16,00: zera, nunca fica negativa.
    expect(payload.coupon?.baseAmount).toBe(16);
    expect(payload.coupon?.discountAmount).toBe(16);
    expect(payload.discount).toBe(16);
    expect(computeSaleTotal(payload.items, payload.discount)).toBe(0);
    // Nada foi recebido: uma forma de pagamento com R$ 0,00 registraria um
    // recebimento que não existiu.
    expect(payload.payments).toEqual([]);
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

  it("deve embutir o acréscimo no preço praticado E mandá-lo em campo próprio", () => {
    // Pendrive de R$ 25,00 com R$ 5,00 de gravação. O servidor confere itens
    // menos desconto contra o total, e NÃO soma o acréscimo por fora: mandar só
    // o campo, sem embutir no preço, faria a venda ser recusada por total
    // divergente; embutir sem o campo perderia o acréscimo para sempre.
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [
        {
          ...ITEM_30,
          price: 25,
          surcharge: 5,
          surchargeReason: "  Gravação de músicas  ",
        },
      ],
      payments: [{ paymentMethodId: 1, amount: 30, installmentNumber: 1 }],
      paymentMethods: [],
      paymentMethodNameById: { 1: "Dinheiro" },
    });

    expect(payload.items[0].unitPrice).toBe(30);
    expect(payload.items[0].surcharge).toBe(5);
    expect(payload.items[0].surchargeReason).toBe("Gravação de músicas");
  });

  it("deve reconstruir o preço de tabela com desconto e acréscimo no mesmo item", () => {
    // Tabela 25, acréscimo 5, desconto 2 → praticado 28.
    // O contrato: unitPrice + discount − surcharge devolve os 25 de tabela.
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [
        {
          ...ITEM_30,
          price: 25,
          discount: 2,
          surcharge: 5,
          surchargeReason: "Gravação de músicas",
        },
      ],
      payments: [{ paymentMethodId: 1, amount: 28, installmentNumber: 1 }],
      paymentMethods: [],
      paymentMethodNameById: { 1: "Dinheiro" },
    });

    const item = payload.items[0];
    expect(item.unitPrice).toBe(28);
    expect(item.unitPrice + (item.discount ?? 0) - (item.surcharge ?? 0)).toBe(25);
  });

  it("deve mandar acréscimo zero e motivo nulo no item sem acréscimo", () => {
    // O servidor exige o par: acréscimo zero com motivo preenchido derruba o
    // CHECK do banco numa venda já paga.
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [ITEM],
      payments: [{ paymentMethodId: 1, amount: 16, installmentNumber: 1 }],
      paymentMethods: [],
      paymentMethodNameById: { 1: "Dinheiro" },
    });

    expect(payload.items[0].surcharge).toBe(0);
    expect(payload.items[0].surchargeReason).toBeNull();
  });

  it("deve ratear o cupom sobre o preço COM acréscimo", () => {
    // Cupom de 10% sobre um pendrive de R$ 25,00 gravado (R$ 30,00) abate
    // R$ 3,00, não R$ 2,50: o cliente pagou 30, e é sobre 30 que o panfleto
    // prometeu 10%. Calcular sobre o preço do produto faria o comprovante
    // discordar da conta do servidor.
    const payload = buildSalePayload({
      sessionId: null,
      consumer: CONSUMER,
      globalDiscount: 0,
      items: [
        {
          ...ITEM_30,
          price: 25,
          surcharge: 5,
          surchargeReason: "Gravação de músicas",
        },
      ],
      payments: [{ paymentMethodId: 1, amount: 27, installmentNumber: 1 }],
      paymentMethods: [],
      paymentMethodNameById: { 1: "Dinheiro" },
      coupon: CUPOM_10,
    });

    expect(payload.coupon?.baseAmount).toBe(30);
    expect(payload.coupon?.discountAmount).toBe(3);
    expect(payload.discount).toBe(3);
  });
});
