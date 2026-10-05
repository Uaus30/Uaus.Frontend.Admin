import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@workspace/api-client-react";
import { getDashboardChampions } from "@/features/dashboard/api";
import type { DashboardChampions } from "../types";

/** Janela fixa do ranking, em dias corridos até hoje. */
export const CHAMPIONS_DAYS = 30;

/** Quantos produtos cada clique em "Ver mais" acrescenta — e o tamanho inicial. */
export const CHAMPIONS_PAGE = 10;

/** Teto do "Ver mais", o mesmo do backend: além disso a lista vira relatório. */
export const CHAMPIONS_MAX = 100;

/**
 * useChampions
 *
 * Produtos campeões: o top por lucro dos últimos 30 dias, com "Ver mais".
 *
 * A janela NÃO segue o seletor de período do painel, de propósito: no começo do
 * mês o período "Este mês" tem três ou quatro dias, pouco para um ranking. Por
 * isso o card diz a janela no próprio título.
 *
 * O "Ver mais" pede de novo com um `take` maior em vez de paginar: a lista é
 * curta e o ranking é recalculado inteiro no servidor de qualquer jeito. Enquanto
 * a próxima página chega, a lista atual continua na tela (`keepPreviousData`), em
 * vez de piscar um esqueleto.
 */
export function useChampions() {
  const [take, setTake] = useState(CHAMPIONS_PAGE);

  const { data, isLoading, isFetching, isError } = useQuery<DashboardChampions>({
    queryKey: ["dashboard", "champions", CHAMPIONS_DAYS, take],
    queryFn: () => getDashboardChampions({ days: CHAMPIONS_DAYS, take }),
    staleTime: STALE_TIME.operacao,
    placeholderData: keepPreviousData,
  });

  return {
    champions: data,
    take,
    canShowMore: Boolean(data?.hasMore) && take < CHAMPIONS_MAX,
    canShowLess: take > CHAMPIONS_PAGE,
    showMore: () => setTake((current) => Math.min(current + CHAMPIONS_PAGE, CHAMPIONS_MAX)),
    showLess: () => setTake(CHAMPIONS_PAGE),
    isLoading,
    isFetching,
    isError,
  };
}
