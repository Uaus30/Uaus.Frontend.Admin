import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardIntelligence } from "@/services/dashboard.service";
import type { DashboardIntelligence } from "../types";

/** Janelas de análise oferecidas no painel de inteligência, em dias. */
export const INTELLIGENCE_WINDOWS = [30, 60, 90, 180, 365] as const;

export type IntelligenceWindow = (typeof INTELLIGENCE_WINDOWS)[number];

export function getIntelligenceQueryKey(lookbackDays: number) {
  return ["dashboard", "intelligence", lookbackDays] as const;
}

/**
 * useSalesIntelligence
 *
 * Prioridade de reposição, afinidade entre produtos e candidatos a isca.
 *
 * Assim como os padrões históricos, começa desabilitado: a análise de cesta é uma
 * auto-junção sobre os itens de venda da janela inteira, o que não pode entrar no
 * caminho crítico da abertura do painel.
 */
export function useSalesIntelligence() {
  const [enabled, setEnabled] = useState(false);
  const [lookbackDays, setLookbackDays] = useState<IntelligenceWindow>(90);

  const { data, isLoading, isFetching, isError, refetch } = useQuery<DashboardIntelligence>({
    queryKey: getIntelligenceQueryKey(lookbackDays),
    queryFn: () => getDashboardIntelligence({ lookbackDays, take: 10 }),
    enabled,
    staleTime: 15 * 60_000,
  });

  return {
    intelligence: data,
    enabled,
    /** Dispara a primeira carga; chamadas seguintes só reaproveitam o cache. */
    load: () => setEnabled(true),
    lookbackDays,
    setLookbackDays,
    isLoading: enabled && isLoading,
    isFetching,
    isError,
    refetch,
  };
}
