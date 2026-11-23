import { useState } from "react";
import {
  useGetCapitalContributionTotalsByPartner,
  useGetCapitalContributions,
  useGetFinancialClosings,
  useGetFinancialReportSummary,
  useGetPurchaseBudget,
} from "@workspace/api-client-react";
import { monthKeyRange, toMonthKey } from "@workspace/core";

/** Quantos fechamentos o histórico mostra — um ano; o resto está na tela de Fechamentos. */
export const HISTORY_SIZE = 12;

/**
 * useFinancialDashboard
 *
 * Hook controlador do Painel Financeiro (`/financeiro/painel`): o mês escolhido
 * e as cinco leituras que a tela junta — a faixa de compras, o resumo do mês
 * (descontos por origem, baixas e sobras), os aportes do mês, o acumulado por
 * sócio e o histórico dos meses fechados.
 *
 * A faixa e o resumo são consultas separadas de propósito: o `PurchaseBudget`
 * traz S, A, V, C, K e F, e o resumo traz o que a faixa não usa (vendas brutas,
 * descontos, baixas, sobras). No backend os dois saem do MESMO serviço de
 * totais, então o V e o K das duas respostas são o mesmo número.
 *
 * Mês futuro não existe aqui: o teto do seletor é o mês corrente, lido uma vez
 * na montagem (componentes LOCAIS, nunca `toISOString`).
 */
export function useFinancialDashboard() {
  const [currentMonth] = useState(() => toMonthKey(new Date()));
  const [month, setMonthState] = useState(currentMonth);
  const range = monthKeyRange(month);

  const budget = useGetPurchaseBudget({ month });
  const summary = useGetFinancialReportSummary({ startDate: range?.start, endDate: range?.end });
  const contributions = useGetCapitalContributions({ month });
  const partnerTotals = useGetCapitalContributionTotalsByPartner();
  const history = useGetFinancialClosings({ page: 1, limit: HISTORY_SIZE });

  /** Troca o mês, sem passar do corrente — "yyyy-MM" ordena como data. */
  function setMonth(next: string) {
    setMonthState(next > currentMonth ? currentMonth : next);
  }

  /** Recarrega as cinco leituras (o botão de atualizar do cabeçalho). */
  function refetchAll() {
    void budget.refetch();
    void summary.refetch();
    void contributions.refetch();
    void partnerTotals.refetch();
    void history.refetch();
  }

  return {
    month,
    currentMonth,
    setMonth,
    budget: budget.data,
    isLoadingBudget: budget.isLoading,
    budgetError: budget.isError ? budget.error : null,
    summary: summary.data,
    isLoadingSummary: summary.isLoading,
    contributions: contributions.data,
    isLoadingContributions: contributions.isLoading,
    partnerTotals: partnerTotals.data ?? [],
    closings: history.data?.data ?? [],
    isLoadingHistory: history.isLoading,
    isFetching:
      budget.isFetching ||
      summary.isFetching ||
      contributions.isFetching ||
      partnerTotals.isFetching ||
      history.isFetching,
    refetchAll,
  };
}
