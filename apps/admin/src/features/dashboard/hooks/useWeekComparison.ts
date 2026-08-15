import { useQuery } from "@tanstack/react-query";
import { apiGetOrThrow, type StorePerformanceDto } from "@workspace/api-client-react";

/**
 * Comparativo da semana atual contra a anterior, dia a dia.
 *
 * Consome o MESMO `GET /Dashboard/performance` que o PDV consome via
 * `/Pdv/performance` — os dois lugares mostram o mesmo número porque a conta é a
 * mesma no servidor, não porque foram escritos iguais.
 */

/** Chave de cache do comparativo semanal do painel. */
export const WEEK_COMPARISON_QUERY_KEY = ["dashboard", "week-comparison"] as const;

export function useWeekComparison() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: WEEK_COMPARISON_QUERY_KEY,
    queryFn: () => apiGetOrThrow<StorePerformanceDto>("/Dashboard/performance"),
    // O comparativo muda a cada venda, mas ninguém o observa segundo a segundo.
    // Um minuto evita refazer a conta a cada volta ao painel.
    staleTime: 60_000,
  });

  return {
    days: data?.weekdayComparison ?? [],
    week: data?.week ?? null,
    isLoading,
    isError,
    error,
    refetch,
  };
}
