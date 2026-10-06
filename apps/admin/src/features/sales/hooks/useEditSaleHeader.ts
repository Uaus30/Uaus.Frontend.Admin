import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProductSalesQueryKey,
  getGetSaleDetailsQueryKey,
  getGetSalesQueryKey,
  updateSaleHeader,
  type SaleDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { closedPeriodNotice, closedPeriodToast, type ClosedPeriod } from "../lib/closed-periods";
import { isSaleInFuture, joinSaleWhen, splitApiDateTime, type SaleWhen } from "../lib/sale-when";
import { useClosingFor } from "./useClosingFor";
import { paymentsProblem, usePaymentSplits } from "./usePaymentSplits";

/**
 * A correção da venda já registrada (06/10/2026, pedido do dono: "editar os dados
 * da venda após o registro, inclusive a data e forma de pagamento").
 *
 * Corrige data, cliente, observação e formas de pagamento. Itens e total não
 * mudam por aqui — as formas precisam somar o total que a venda já tem. As
 * travas (caixa, cupom, mês fechado) são do servidor, que recusa com a frase
 * certa; a tela só mostra.
 *
 * As formas que vieram da venda voltam com parcelas, parcelamento e taxa: sem
 * eles o servidor entenderia que mudaram — e numa venda de caixa fechado
 * recusaria a correção só da observação.
 */
export function useEditSaleHeader(
  sale: SaleDto,
  paymentMethods: Array<{ id: number; isActive?: boolean }>,
  onSaved: () => void,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Começa do que está gravado. Outra venda é outro formulário: quem usa monta
  // este hook com `key` da venda, e o estado nasce de novo — sem efeito copiando
  // a venda para o estado.
  const [recorded] = useState<SaleWhen>(() => splitApiDateTime(sale.createdAt));
  const [when, setWhen] = useState<SaleWhen>(recorded);
  const dateChanged = when.date !== recorded.date || when.time !== recorded.time;
  // A data que entra num mês fechado, ou sai de um, deixa o fechamento
  // desatualizado: permitido, com aviso (decisão do dono, 06/10/2026).
  // Mudar dentro do MESMO período fechado não mexe nos totais dele: sem aviso.
  // De um período fechado para OUTRO, os dois ficam desatualizados — a receita
  // sai de um e entra no outro —, e o aviso cita os dois.
  const closingFor = useClosingFor();
  const closingBefore = closingFor(recorded.date);
  const closingAfter = closingFor(when.date);
  const closings =
    dateChanged && closingBefore?.id !== closingAfter?.id
      ? [closingAfter, closingBefore].filter((closing): closing is ClosedPeriod => closing !== null)
      : [];
  const [customerId, setCustomerId] = useState<number | null>(sale.customerId ?? null);
  const [notes, setNotes] = useState(sale.notes ?? "");
  const [saving, setSaving] = useState(false);
  const total = sale.total;
  const splits = usePaymentSplits(
    total,
    paymentMethods,
    (sale.payments ?? []).map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      amount: payment.amount ?? 0,
      installments: payment.installments,
      paymentMethodInstallmentId: payment.paymentMethodInstallmentId ?? null,
      transactionFee: payment.transactionFee,
    })),
  );

  async function submit() {
    // Só a data MEXIDA passa pelo "futuro": com o relógio do celular atrasado em
    // relação ao servidor, a venda recém-feita no PDV parecia futura e ficava
    // sem correção até o relógio alcançar.
    const recusa =
      dateChanged && isSaleInFuture(when)
        ? "A data da venda não pode ser no futuro."
        : paymentsProblem(splits.payments, total, splits.remainingAmount);
    if (recusa) {
      toast({ title: "Não dá para salvar ainda", description: recusa, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await updateSaleHeader(sale.id, {
        occurredAt: joinSaleWhen(when),
        customerId,
        notes: notes.trim() || null,
        payments: splits.payments,
      });
      // O detalhe da venda é DESCARTADO, e não só invalidado: ele fechou quando a
      // correção abriu, e a consulta inativa invalidada continuaria mostrando a
      // versão velha ao reabrir, até a releitura chegar. Tocando em "Corrigir
      // venda" nesse intervalo, o formulário nasceria do antigo — e salvar
      // desfaria a correção.
      queryClient.removeQueries({ queryKey: [...getGetSaleDetailsQueryKey(), sale.id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetProductSalesQueryKey() }),
      ]);
      toast({
        title: "Venda corrigida.",
        description: closings.length > 0 ? closings.map(closedPeriodToast).join(" ") : undefined,
      });
      onSaved();
    } catch (error) {
      toast({
        title: "Não foi possível corrigir a venda",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    when,
    setWhen,
    dateChanged,
    /** Um aviso por fechamento que a data nova deixa desatualizado (zero, um ou dois). */
    closedPeriodNotices: closings.map(closedPeriodNotice),
    customerId,
    setCustomerId,
    notes,
    setNotes,
    total,
    ...splits,
    saving,
    submit,
  };
}
