import type { PaymentMethodDto } from "@workspace/api-client-react";
import { round2 } from "@workspace/core";
import type { RegisterSalePayload } from "@/services/sales.service";
import { computeCartTotals } from "@/stores/use-pdv-store";
import type { AppliedCoupon, CheckoutPayment, PdvItem, PdvConsumer } from "../types";

/** O que a tela tem em mãos na hora de gravar a venda. */
export interface BuildSalePayloadParams {
  /** Sessão de caixa aberta, ou `null` numa loja sem controle de caixa. */
  sessionId: number | null;
  consumer: PdvConsumer;
  /** Desconto aplicado sobre o total da venda, SEM o cupom. */
  globalDiscount: number;
  items: PdvItem[];
  payments: CheckoutPayment[];
  /** Formas em uso, com as parcelas ativas e suas taxas. */
  paymentMethods: PaymentMethodDto[];
  /** Nome de cada forma por ID, usado quando a forma não está mais na lista. */
  paymentMethodNameById: Record<number, string>;
  /**
   * Cupom aplicado na venda, ou ausente/`null` quando não houve.
   *
   * Chega como DEFINIÇÃO (código, tipo, valor), nunca como reais: o abatimento é
   * derivado aqui, do carrinho que está sendo gravado. Ver `AppliedCoupon`.
   */
  coupon?: AppliedCoupon | null;
}

/**
 * Traduz carrinho e checkout no payload da venda.
 *
 * Quatro decisões aqui não são óbvias e já custaram caro:
 *
 * 1. **O desconto vai separado do preço.** Sem ele o backend não distingue um
 *    produto que custa R$ 8 de um de R$ 10 com R$ 2 de desconto, e o contrato do
 *    DTO diz que `unitPrice + discount` reconstrói o preço de tabela do momento
 *    da venda. É disso que dependem o relatório de descontos e a auditoria.
 * 2. **A taxa é calculada no PDV, sobre a parcela escolhida.** Ela sai do
 *    percentual da parcela **ativa** daquela forma; parcela inativa (ou forma
 *    que veio da base local sem a parcela) vale zero, nunca a taxa de outra
 *    parcela.
 * 3. **`discount` é o desconto TOTAL e o cupom é uma PARCELA dele.** O bloco
 *    `coupon.discountAmount` está DENTRO de `discount`, nunca somado por fora —
 *    somar os dois faria o servidor recusar a venda por total divergente, e
 *    manter o cupom fora inflaria o lucro em todo relatório que consolida venda
 *    (é a §1 do plano). O que o servidor faz com a discriminação é excluir o
 *    cupom do limite de desconto do vendedor: sem ela, todo cupom de 10% passaria
 *    a exigir senha de administrador no balcão.
 * 4. **Venda zerada pelo cupom vai com a lista de pagamentos VAZIA.** Nada foi
 *    recebido; mandar a forma escolhida com R$ 0,00 registraria um recebimento
 *    que não existiu e o servidor recusaria a venda.
 *
 * Os totais saem de `computeCartTotals` — a MESMA função que o carrinho usa para
 * exibir o total. Enquanto a tela e o payload calculavam cada um o seu, o
 * desconto global aparecia na tela e não era descontado do que ia ao servidor.
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
  coupon = null,
}: BuildSalePayloadParams): RegisterSalePayload {
  const totals = computeCartTotals(items, globalDiscount, coupon);

  // Base do cupom: o que restou DEPOIS do desconto global, nunca o subtotal cru.
  // O servidor confere `discountAmount <= baseAmount` e o CHECK do banco repete a
  // conferência; calcular sobre o subtotal cru daria um abatimento maior que o
  // impresso no comprovante que o cliente levou.
  const couponBase = round2(totals.subtotal - totals.globalDiscount);

  return {
    cashRegisterSessionId: sessionId,
    customerId: consumer.customerId,
    customerDocument: consumer.document,
    discount: round2(totals.globalDiscount + totals.couponDiscount),
    coupon: coupon
      ? {
          couponId: coupon.couponId,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          baseAmount: couponBase,
          discountAmount: totals.couponDiscount,
          answers: coupon.answers.map((answer) => ({
            questionId: answer.questionId,
            optionId: answer.optionId,
          })),
        }
      : null,
    items: items.map((item) => {
      const surcharge = round2(item.surcharge ?? 0);

      return {
        productId: item.productId,
        quantity: item.quantity,
        // O acréscimo entra no preço praticado, e NÃO é somado por fora no
        // servidor: a conferência de total de lá é itens menos desconto, então
        // mandá-lo nos dois lugares faria a venda ser recusada por total
        // divergente com o cliente no balcão. A coluna própria abaixo é
        // auditoria — é o que separa produto de serviço no relatório e o que o
        // limite de desconto do vendedor desconta da base.
        unitPrice: round2(item.price - item.discount + surcharge),
        discount: item.discount,
        surcharge,
        surchargeReason: surcharge > 0 ? (item.surchargeReason?.trim() ?? "") : null,
        productName: item.name,
      };
    }),
    payments:
      totals.total === 0
        ? []
        : payments.map((payment) => {
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
