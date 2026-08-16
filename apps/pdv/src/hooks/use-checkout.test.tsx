import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CASH_PAYMENT_METHOD_ID, type PaymentMethodDto } from "@workspace/api-client-react";
import { computeSaleTotals } from "@workspace/core";
import { useCheckout } from "./use-checkout";

/**
 * Formas de pagamento de teste. `CASH_PAYMENT_METHOD_ID` é o dinheiro; a de id
 * 2 tem taxa de 2% na parcela 1 e 5% na parcela 3, para cobrir o feeAmount.
 */
const paymentMethods: PaymentMethodDto[] = [
  {
    id: CASH_PAYMENT_METHOD_ID,
    name: "Dinheiro",
    isActive: true,
    installments: [
      {
        id: 1,
        paymentMethodId: CASH_PAYMENT_METHOD_ID,
        installmentNumber: 1,
        feePercentage: 0,
        isActive: true,
      },
    ],
  },
  {
    id: 2,
    name: "Cartão de Crédito",
    isActive: true,
    installments: [
      { id: 2, paymentMethodId: 2, installmentNumber: 1, feePercentage: 2, isActive: true },
      { id: 3, paymentMethodId: 2, installmentNumber: 3, feePercentage: 5, isActive: true },
      { id: 4, paymentMethodId: 2, installmentNumber: 6, feePercentage: 9, isActive: false },
    ],
  },
];

describe("useCheckout", () => {
  it("cobra o total pós-desconto, não o subtotal", () => {
    // REGRESSÃO — o defeito que motivou este arquivo.
    //
    // A tela passava `subtotal` para o hook enquanto a venda era gravada com
    // `subtotal − desconto`. Com desconto global o caixa cobrava a mais: o
    // carrinho mostrava R$ 80, o cliente pagava R$ 100 e a venda registrava
    // R$ 80. Aqui o valor a receber tem que ser o MESMO que vai para a API.
    const totais = computeSaleTotals({
      items: [{ unitPrice: 100, quantity: 1, unitDiscount: 0 }],
      globalDiscount: 20,
    });

    expect(totais.total).toBe(80);

    const { result } = renderHook(() => useCheckout(totais.total, paymentMethods));

    act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));

    expect(result.current.payments[0].amount).toBe(80);
    expect(result.current.paidAmount).toBe(80);
    expect(result.current.remainingAmount).toBe(0);
  });

  it("com desconto de item e global, ainda cobra exatamente o total gravado", () => {
    const totais = computeSaleTotals({
      items: [
        { unitPrice: 19.99, quantity: 3, unitDiscount: 1.5 },
        { unitPrice: 5.25, quantity: 2, unitDiscount: 0 },
      ],
      globalDiscount: 7.35,
    });

    const { result } = renderHook(() => useCheckout(totais.total, paymentMethods));

    act(() => result.current.togglePaymentMethod(2));

    expect(result.current.paidAmount).toBe(totais.total);
    expect(result.current.remainingAmount).toBe(0);
  });

  describe("paidAmount e remainingAmount", () => {
    it("começam zerados, com o total inteiro a receber", () => {
      const { result } = renderHook(() => useCheckout(50, paymentMethods));

      expect(result.current.paidAmount).toBe(0);
      expect(result.current.remainingAmount).toBe(50);
    });

    it("acompanham o pagamento parcial no modo dividido", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 30));

      expect(result.current.paidAmount).toBe(30);
      expect(result.current.remainingAmount).toBe(70);
    });

    it("ficam negativos quando o cliente paga a mais, em vez de esconder a sobra", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 150));

      expect(result.current.remainingAmount).toBe(-50);
    });

    it("não propagam erro de ponto flutuante", () => {
      const { result } = renderHook(() => useCheckout(0.3, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 0.1));

      expect(result.current.remainingAmount).toBe(0.2);
    });
  });

  describe("feeAmount", () => {
    it("é zero sem taxa na parcela escolhida", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));

      expect(result.current.feeAmount).toBe(0);
    });

    it("aplica o percentual da parcela escolhida", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.togglePaymentMethod(2));

      expect(result.current.feeAmount).toBe(2);

      act(() => result.current.updatePaymentInstallment(2, 3));

      expect(result.current.feeAmount).toBe(5);
    });

    it("ignora parcela inativa — a taxa dela não vale mais", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.togglePaymentMethod(2));
      act(() => result.current.updatePaymentInstallment(2, 6));

      expect(result.current.feeAmount).toBe(0);
    });

    it("soma as taxas de cada forma no pagamento dividido", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 50));
      act(() => result.current.togglePaymentMethod(2));

      // Dinheiro não tem taxa; 2% sobre os 50 restantes do cartão.
      expect(result.current.feeAmount).toBe(1);
    });
  });

  describe("togglePaymentMethod", () => {
    it("substitui a forma quando o pagamento não está dividido", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.togglePaymentMethod(2));

      expect(result.current.payments).toHaveLength(1);
      expect(result.current.payments[0].paymentMethodId).toBe(2);
      expect(result.current.payments[0].amount).toBe(100);
    });

    it("dá à forma nova só o que ainda falta receber", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 40));
      act(() => result.current.togglePaymentMethod(2));

      expect(result.current.payments[1].amount).toBe(60);
    });

    it("nunca atribui valor negativo à forma nova", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 150));
      act(() => result.current.togglePaymentMethod(2));

      expect(result.current.payments[1].amount).toBe(0);
    });

    it("remove a forma no modo dividido, mas nunca a última", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.togglePaymentMethod(2));

      expect(result.current.payments).toHaveLength(2);

      act(() => result.current.togglePaymentMethod(2));

      expect(result.current.payments).toHaveLength(1);

      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));

      expect(result.current.payments).toHaveLength(1);
    });
  });

  describe("conferência do dinheiro", () => {
    it("calcula o troco sobre a parte em dinheiro", () => {
      const { result } = renderHook(() => useCheckout(87.5, paymentMethods));

      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.setAmountReceived("100,00"));

      expect(result.current.change).toBe(12.5);
      expect(result.current.cashShortfall).toBe(0);
    });

    it("acusa a falta quando o cliente entrega menos", () => {
      const { result } = renderHook(() => useCheckout(11.5, paymentMethods));

      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.setAmountReceived("10,00"));

      expect(result.current.change).toBe(0);
      expect(result.current.cashShortfall).toBe(1.5);
    });

    it("trata campo vazio como valor exato", () => {
      const { result } = renderHook(() => useCheckout(50, paymentMethods));

      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));

      expect(result.current.receivedAmount).toBeNull();
      expect(result.current.change).toBe(0);
      expect(result.current.cashShortfall).toBe(0);
    });
  });

  describe("toggleSplitPayment", () => {
    it("volta para uma forma só com o total inteiro ao desligar a divisão", () => {
      const { result } = renderHook(() => useCheckout(100, paymentMethods));

      act(() => result.current.setSplitPayment(true));
      act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
      act(() => result.current.updatePaymentAmount(CASH_PAYMENT_METHOD_ID, 40));
      act(() => result.current.togglePaymentMethod(2));
      act(() => result.current.toggleSplitPayment());

      expect(result.current.payments).toHaveLength(1);
      expect(result.current.payments[0].amount).toBe(100);
    });
  });

  it("resetCheckout limpa pagamentos, divisão e valor recebido", () => {
    const { result } = renderHook(() => useCheckout(100, paymentMethods));

    act(() => result.current.setSplitPayment(true));
    act(() => result.current.togglePaymentMethod(CASH_PAYMENT_METHOD_ID));
    act(() => result.current.setAmountReceived("100,00"));
    act(() => result.current.resetCheckout());

    expect(result.current.payments).toEqual([]);
    expect(result.current.splitPayment).toBe(false);
    expect(result.current.amountReceived).toBe("");
  });
});
