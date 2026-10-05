import { useQuery } from "@tanstack/react-query";
import { getDashboardMonthly } from "@/features/dashboard/api";
import type { DashboardMonthly } from "../types";
import { STALE_TIME } from "@workspace/api-client-react";

/** Meses trazidos no histórico, incluindo o corrente. */
const HISTORY_MONTHS = 12;

export const MONTHLY_QUERY_KEY = ["dashboard", "monthly", HISTORY_MONTHS] as const;

/**
 * useMonthlyComparison
 *
 * Mês corrente e anterior dia a dia, a projeção do mês e a régua do dia "normal".
 * Alimenta a matriz de faturamento diário, a curva acumulada e a projeção do card
 * de faturamento — todos independentes do período escolhido no seletor.
 */
export function useMonthlyComparison() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardMonthly>({
    queryKey: MONTHLY_QUERY_KEY,
    queryFn: () => getDashboardMonthly(HISTORY_MONTHS),
    // Os totais mudam a cada venda, mas o gráfico é de leitura mensal: cinco
    // minutos de cache evitam refazer doze meses de agregação à toa.
    staleTime: STALE_TIME.catalogo,
  });

  return { monthly: data, isLoading, isError, refetch };
}
