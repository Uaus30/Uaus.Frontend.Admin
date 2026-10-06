import { useMemo, useState } from "react";
import { round2 } from "@workspace/core";
import type { SalePaymentPayload } from "@workspace/api-client-react";
import { isSelectableMethod } from "../lib/payment-method-options";

/**
 * Uma forma de pagamento da venda, no formato que a API recebe. Parcelas,
 * parcelamento e taxa vêm da venda já gravada (correção) e voltam intactos: sem
 * eles o servidor entenderia que a forma mudou.
 */
export type PaymentSplit = SalePaymentPayload;

/**
 * As formas de pagamento de uma venda — a nova e a correção usam o mesmo.
 *
 * - Com UMA forma, o valor acompanha o total sozinho: é o caso de quase toda
 *   venda, e digitar o total duas vezes é erro esperando acontecer.
 * - A forma acrescentada entra com o que falta distribuir, e é sempre uma ATIVA.
 * - Trocar a forma de uma linha zera parcelas, parcelamento e taxa: eram da forma
 *   anterior.
 */
export function usePaymentSplits(
  total: number,
  methods: Array<{ id: number; isActive?: boolean }>,
  initial: PaymentSplit[] = [],
) {
  const [stored, setPayments] = useState<PaymentSplit[]>(initial);

  // Com UMA forma, o valor É o total — derivado na hora, e não copiado por um
  // efeito (que renderizaria duas vezes e deixaria um quadro com o valor velho).
  const payments = useMemo(
    () => (stored.length === 1 ? [{ ...stored[0], amount: total }] : stored),
    [stored, total],
  );

  const paidAmount = useMemo(
    () => round2(payments.reduce((sum, payment) => sum + payment.amount, 0)),
    [payments],
  );
  const remainingAmount = round2(total - paidAmount);

  function addPayment() {
    const used = new Set(payments.map((payment) => payment.paymentMethodId));
    const next = methods.find((method) => isSelectableMethod(method) && !used.has(method.id));
    if (!next) return;
    // Parte do que está NA TELA: a forma única passa a guardar o total que mostrava.
    setPayments([...payments, { paymentMethodId: next.id, amount: Math.max(0, remainingAmount) }]);
  }

  function removePayment(index: number) {
    setPayments(payments.filter((_, position) => position !== index));
  }

  function updatePayment(index: number, patch: Partial<PaymentSplit>) {
    setPayments(
      payments.map((payment, position) => {
        if (position !== index) return payment;
        const methodChanged =
          patch.paymentMethodId !== undefined && patch.paymentMethodId !== payment.paymentMethodId;
        return methodChanged
          ? { paymentMethodId: patch.paymentMethodId!, amount: patch.amount ?? payment.amount }
          : { ...payment, ...patch };
      }),
    );
  }

  return { payments, setPayments, paidAmount, remainingAmount, addPayment, removePayment, updatePayment };
}

/** A recusa das formas que não fecham com o total, ou nulo quando fecham. */
export function paymentsProblem(
  payments: PaymentSplit[],
  total: number,
  remainingAmount: number,
): string | null {
  if (total > 0 && payments.length === 0) return "Adicione a forma de pagamento.";
  if (Math.abs(remainingAmount) > 0.01) {
    return remainingAmount > 0
      ? `Faltam ${remainingAmount.toFixed(2).replace(".", ",")} a distribuir nas formas de pagamento.`
      : `As formas de pagamento passam ${Math.abs(remainingAmount).toFixed(2).replace(".", ",")} do total.`;
  }
  return null;
}
