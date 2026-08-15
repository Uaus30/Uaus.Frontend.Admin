import { useQuery } from "@tanstack/react-query";
import { getDashboardToday } from "@/features/dashboard/api";
import type { DashboardToday } from "../types";

/**
 * Intervalo de atualização do painel do dia.
 *
 * Um minuto acompanha o balcão sem transformar o dashboard em uma fonte de
 * carga: a consulta cobre um único dia e é barata, mas cada aba aberta a repete.
 */
const REFETCH_INTERVAL_MS = 60_000;

export const LIVE_TODAY_QUERY_KEY = ["dashboard", "today"] as const;

/**
 * useLiveToday
 *
 * Faturamento do dia corrente, atualizado sozinho enquanto a aba está visível.
 *
 * `refetchIntervalInBackground` fica desligado de propósito: um painel esquecido
 * aberto a noite inteira continuaria consultando a API sem ninguém olhando.
 */
export function useLiveToday() {
  const { data, isLoading, isFetching, isError, dataUpdatedAt, refetch } = useQuery<DashboardToday>({
    queryKey: LIVE_TODAY_QUERY_KEY,
    queryFn: getDashboardToday,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  return {
    today: data,
    isLoading,
    isFetching,
    isError,
    /** Quando o dado exibido chegou, para o rótulo "atualizado às". */
    updatedAt: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refetch,
  };
}
