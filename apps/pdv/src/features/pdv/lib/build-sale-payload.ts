import type { PaymentMethodDto } from "@workspace/api-client-react";
import { round2 } from "@workspace/core";
import type { RegisterSalePayload } from "@/services/sales.service";
import type { CheckoutPayment, PdvItem, PdvConsumer } from "../types";

/** O que a tela tem em mãos na hora de gravar a venda. */
export interface BuildSalePayloadParams {
  /** Sessão de caixa aberta, ou `null` numa loja sem controle de caixa. */
  sessionId: number | null;
  consumer: PdvConsumer;
  /** Desconto aplicado sobre o total da venda. */
  globalDiscount: number;
  items: PdvItem[];
  payments: CheckoutPayment[];
  /** Formas em uso, com as parcelas ativas e suas taxas. */
  paymentMethods: PaymentMethodDto[];
  /** Nome de cada forma por ID, usado quando a forma não está mais na lista. */
  paymentMethodNameById: Record<number, string>;
}

/**
 * Traduz carrinho e checkout no payload da venda.
 *
 * Duas decisões aqui não são óbvias e já custaram caro:
 *
 * 1. **O desconto vai separado do preço.** Sem ele o backend não distingue um
 *    produto que custa R$ 8 de um de R$ 10 com R$ 2 de desconto, e o contrato do
 *    DTO diz que `unitPrice + discount` reconstrói o preço de tabela do momento
 *    da venda. É disso que dependem o relatório de descontos e a auditoria.
 * 2. **A taxa é calculada no PDV, sobre a parcela escolhida.** Ela sai do
 *    percentual da parcela **ativa** daquela forma; parcela inativa (ou forma
 *    que veio da base local sem a parcela) vale zero, nunca a taxa de outra
 *    parcela.
 *
 * O nome do produto e o da forma de pagamento viajam junto por causa da fila
 * offline: a lista de pendências e o cupom precisam deles, e a base local pode
 * ter mudado quando a venda finalmente subir.
 */
export function buildSalePayload({
  sessionId,
  consumer,
  globalDiscount,
  items,
  payments,
  paymentMethods,
  paymentMethodNameById,
}: BuildSalePayloadParams): RegisterSalePayload {
  return {
    cashRegisterSessionId: sessionId,
    customerId: consumer.customerId,
    customerDocument: consumer.document,
    discount: globalDiscount,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: round2(item.price - item.discount),
      discount: item.discount,
      productName: item.name,
    })),
    payments: payments.map((payment) => {
      const method = paymentMethods.find((pm) => pm.id === payment.paymentMethodId);
      const installment = method?.installments.find(
        (i) => i.installmentNumber === payment.installmentNumber && i.isActive,
      );

      return {
        paymentMethodId: payment.paymentMethodId,
        paymentMethodInstallmentId: installment?.id ?? null,
        amount: round2(payment.amount),
        installments: payment.installmentNumber,
        transactionFee: round2((payment.amount * (installment?.feePercentage ?? 0)) / 100),
        paymentMethodName: method?.name ?? paymentMethodNameById[payment.paymentMethodId],
      };
    }),
  };
}
