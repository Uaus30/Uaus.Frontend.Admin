import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { getDashboardPatterns, refreshDashboardPatterns } from "@/features/dashboard/api";
import type { DashboardPatterns } from "../types";

/** Janelas oferecidas no seletor do painel de padrões. */
export const PATTERN_WINDOWS = [3, 6, 12, 24] as const;

export type PatternWindow = (typeof PATTERN_WINDOWS)[number];

export function getPatternsQueryKey(months: number) {
  return ["dashboard", "patterns", months] as const;
}

/**
 * useSalesPatterns
 *
 * Padrões históricos de faturamento por dia da semana, hora do dia e dia do mês.
 *
 * A consulta começa **desabilitada** e só dispara quando o usuário abre o painel.
 * São meses de vendas por trás de três gráficos que mudam uma vez por dia; puxar
 * isso em toda abertura do dashboard atrasaria a tela inteira por um dado que a
 * maioria dos acessos não olha.
 *
 * Do lado do servidor o custo já é amortizado pela tabela `dashboard_sales_hourly`,
 * recalculada sozinha a cada doze horas. `isStale` indica que entraram vendas
 * depois do último processamento — daí o botão de recalcular.
 */
export function useSalesPatterns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(false);
  const [months, setMonths] = useState<PatternWindow>(12);

  const { data, isLoading, isFetching, isError } = useQuery<DashboardPatterns>({
    queryKey: getPatternsQueryKey(months),
    queryFn: () => getDashboardPatterns(months),
    enabled,
    staleTime: 30 * 60_000,
  });

  const refresh = useMutation({
    mutationFn: () => refreshDashboardPatterns(false),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "patterns"] });
      toast({
        title: "Padrões recalculados",
        description: result?.wasFullRebuild
          ? "Todo o histórico foi reprocessado."
          : "As vendas recentes entraram na análise.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Não foi possível recalcular",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return {
    patterns: data,
    enabled,
    /** Dispara a primeira carga; chamadas seguintes só reaproveitam o cache. */
    load: () => setEnabled(true),
    months,
    setMonths,
    isLoading: enabled && isLoading,
    isFetching,
    isError,
    refresh: () => refresh.mutate(),
    isRefreshing: refresh.isPending,
  };
}
