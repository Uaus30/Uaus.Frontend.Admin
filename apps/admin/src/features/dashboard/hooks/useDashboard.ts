import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboardOverview } from "@/services/dashboard.service";
import type { DashboardOverview, PeriodMode, PeriodPreset } from "../types";
import { DEFAULT_PERIOD, resolveCustom, resolvePreset } from "../utils";

/** Chave de cache da visão geral, parametrizada pelo intervalo consultado. */
export function getOverviewQueryKey(startDate: string, endDate: string) {
  return ["dashboard", "overview", startDate, endDate] as const;
}

/**
 * useDashboard
 *
 * Controla o período exibido no painel e busca a visão geral correspondente.
 *
 * O período vive aqui, e não em cada painel, porque os cards, o gráfico de
 * faturamento e o ranking de produtos precisam responder ao mesmo recorte — se
 * cada um guardasse o seu, a tela mostraria intervalos diferentes lado a lado.
 *
 * O comparativo mensal, os padrões históricos e a inteligência comercial têm
 * hooks próprios: eles não dependem do período escolhido.
 */
export function useDashboard() {
  const queryClient = useQueryClient();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("preset");
  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PERIOD);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");

  const period = useMemo(() => {
    if (periodMode === "custom" && appliedStart && appliedEnd) {
      return resolveCustom(appliedStart, appliedEnd);
    }
    return resolvePreset(preset);
  }, [periodMode, appliedStart, appliedEnd, preset]);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<DashboardOverview>({
    queryKey: getOverviewQueryKey(period.startDate, period.endDate),
    queryFn: () => getDashboardOverview({ startDate: period.startDate, endDate: period.endDate }),
    // O intervalo fechado não muda sozinho; meio minuto evita refazer a consulta
    // a cada volta para a aba sem deixar o dado envelhecer.
    staleTime: 30_000,
  });

  /**
   * Aplica um intervalo personalizado.
   *
   * As datas chegam por parâmetro porque o calendário fecha as duas pontas na
   * mesma interação: ler o estado aqui pegaria o valor anterior.
   */
  function handleApplyCustom(start: string = customStart, end: string = customEnd) {
    if (!start || !end) return;
    setAppliedStart(start);
    setAppliedEnd(end);
    setPeriodMode("custom");
  }

  /** Volta para um dos períodos pré-configurados. */
  function handleSelectPreset(value: string) {
    setPreset(value as PeriodPreset);
    setPeriodMode("preset");
  }

  /** Descarta o intervalo personalizado e volta ao preset anterior. */
  function handleClearCustom() {
    setPeriodMode("preset");
    setCustomStart("");
    setCustomEnd("");
    setAppliedStart("");
    setAppliedEnd("");
  }

  /** Recarrega todos os painéis do dashboard, inclusive os carregados sob demanda. */
  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return {
    period,
    periodMode,
    preset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    handleApplyCustom,
    handleSelectPreset,
    handleClearCustom,
    overview: data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    refreshAll,
  };
}
