import { useState } from "react";
import { type PaymentMethodDto, CASH_PAYMENT_METHOD_ID } from "@workspace/api-client-react";
import { computeCashSettlement, round2 } from "@/lib/checkout";

export type CheckoutPayment = {
  paymentMethodId: number;
  amount: number;
  installmentNumber: number;
};

export type CheckoutState = ReturnType<typeof useCheckout>;

export function useCheckout(total: number, paymentMethods: PaymentMethodDto[]) {
  const [payments, setPayments] = useState<CheckoutPayment[]>([]);
  const [splitPayment, setSplitPayment] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");

  const paidAmount = round2(payments.reduce((sum, p) => sum + (p.amount || 0), 0));
  const remainingAmount = round2(total - paidAmount);

  const feeAmount = round2(
    payments.reduce((sum, payment) => {
      const method = paymentMethods.find((pm) => pm.id === payment.paymentMethodId);
      const installment = method?.installments.find(
        (i) => i.installmentNumber === payment.installmentNumber && i.isActive,
      );
      return sum + (payment.amount || 0) * ((installment?.feePercentage ?? 0) / 100);
    }, 0),
  );

  const cashPayment = payments.find((p) => p.paymentMethodId === CASH_PAYMENT_METHOD_ID);

  const {
    received: receivedAmount,
    change,
    shortfall: cashShortfall,
  } = computeCashSettlement(cashPayment?.amount ?? null, amountReceived);

  function togglePaymentMethod(methodId: number) {
    setPayments((current) => {
      if (!splitPayment) {
        return [{ paymentMethodId: methodId, amount: round2(total), installmentNumber: 1 }];
      }

      const existing = current.find((p) => p.paymentMethodId === methodId);
      if (existing) {
        if (current.length === 1) return current;
        return current.filter((p) => p.paymentMethodId !== methodId);
      }

      const used = round2(current.reduce((sum, p) => sum + (p.amount || 0), 0));
      return [
        ...current,
        { paymentMethodId: methodId, amount: Math.max(0, round2(total - used)), installmentNumber: 1 },
      ];
    });
  }

  function updatePaymentAmount(methodId: number, amount: number) {
    setPayments((current) =>
      current.map((p) => (p.paymentMethodId === methodId ? { ...p, amount } : p)),
    );
  }

  function updatePaymentInstallment(methodId: number, installmentNumber: number) {
    setPayments((current) =>
      current.map((p) => (p.paymentMethodId === methodId ? { ...p, installmentNumber } : p)),
    );
  }

  function toggleSplitPayment() {
    setSplitPayment((current) => {
      const next = !current;
      if (!next) {
        setPayments((list) =>
          list.length > 0
            ? [{ paymentMethodId: list[0].paymentMethodId, amount: round2(total), installmentNumber: 1 }]
            : [],
        );
      }
      return next;
    });
  }

  function resetCheckout() {
    setPayments([]);
    setSplitPayment(false);
    setAmountReceived("");
  }

  return {
    paymentMethods,
    payments,
    setPayments,
    splitPayment,
    setSplitPayment,
    amountReceived,
    setAmountReceived,
    paidAmount,
    remainingAmount,
    feeAmount,
    cashPayment,
    receivedAmount,
    change,
    cashShortfall,
    togglePaymentMethod,
    updatePaymentAmount,
    updatePaymentInstallment,
    toggleSplitPayment,
    resetCheckout,
  };
}


