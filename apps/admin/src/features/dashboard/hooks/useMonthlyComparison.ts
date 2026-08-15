import { useQuery } from "@tanstack/react-query";
import { getDashboardMonthly } from "@/features/dashboard/api";
import type { DashboardMonthly } from "../types";
import { growth } from "../utils";

/** Meses trazidos no histórico, incluindo o corrente. */
const HISTORY_MONTHS = 12;

export const MONTHLY_QUERY_KEY = ["dashboard", "monthly", HISTORY_MONTHS] as const;

/**
 * useMonthlyComparison
 *
 * Mês corrente contra o anterior, com os dois comparativos que a tela precisa
 * mostrar lado a lado:
 *
 * - **Total do mês** — o mês corrente ainda incompleto contra o anterior fechado.
 *   Sozinho ele mente para baixo em todo dia que não seja o último do mês.
 * - **Mesmo dia** — o mês anterior recortado no dia de hoje. É o número que
 *   responde "estamos melhores ou piores que no mês passado".
 */
export function useMonthlyComparison() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardMonthly>({
    queryKey: MONTHLY_QUERY_KEY,
    queryFn: () => getDashboardMonthly(HISTORY_MONTHS),
    // Os totais mudam a cada venda, mas o gráfico é de leitura mensal: cinco
    // minutos de cache evitam refazer doze meses de agregação à toa.
    staleTime: 5 * 60_000,
  });

  const comparison = data
    ? {
        /** Variação contra o mês anterior recortado no mesmo dia. */
        sameDayGrowth: growth(data.currentMonth.revenue, data.previousMonthSameDayRevenue),
        /** Variação contra o total fechado do mês anterior. */
        fullMonthGrowth: growth(data.currentMonth.revenue, data.previousMonth.revenue),
        /** Variação da projeção contra o mês anterior fechado. */
        projectedGrowth: growth(data.projectedRevenue, data.previousMonth.revenue),
        profitSameDayGrowth: growth(data.currentMonth.profit, data.previousMonthSameDayProfit),
      }
    : null;

  return { monthly: data, comparison, isLoading, isError, refetch };
}
