import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIME } from "@workspace/api-client-react";
import { getDashboardOverview } from "@/features/dashboard/api";
import type { DashboardOverview, PeriodMode, PeriodPreset } from "../types";
import { DEFAULT_PERIOD, resolveComparison, resolveCustom, resolvePreset } from "../utils";

/**
 * Chave de cache da visão geral, parametrizada pelo intervalo consultado e pela
 * base de comparação — o mesmo intervalo comparado com bases diferentes são
 * respostas diferentes.
 */
export function getOverviewQueryKey(
  startDate: string,
  endDate: string,
  compareStartDate: string,
  compareEndDate: string,
) {
  return ["dashboard", "overview", startDate, endDate, compareStartDate, compareEndDate] as const;
}

/**
 * useDashboard
 *
 * Controla o período exibido no painel e busca a visão geral correspondente.
 *
 * O período vive aqui, e não em cada painel, porque os cards e as quebras
 * precisam responder ao mesmo recorte — se cada um guardasse o seu, a tela
 * mostraria intervalos diferentes lado a lado. A base de comparação dos cards
 * também nasce aqui (`resolveComparison`), junto do período que ela acompanha.
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

  // A base depende do tipo de período, não só das datas: o mês em curso compara
  // com os mesmos dias da semana de semanas antes, e um intervalo livre que por
  // acaso cubra o mês inteiro compara com o período imediatamente anterior.
  const comparison = useMemo(
    () => resolveComparison(periodMode === "preset" ? preset : null, period),
    [periodMode, preset, period],
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery<DashboardOverview>({
    queryKey: getOverviewQueryKey(period.startDate, period.endDate, comparison.startDate, comparison.endDate),
    queryFn: () =>
      getDashboardOverview({
        startDate: period.startDate,
        endDate: period.endDate,
        compareStartDate: comparison.startDate,
        compareEndDate: comparison.endDate,
      }),
    // O intervalo fechado não muda sozinho; meio minuto evita refazer a consulta
    // a cada volta para a aba sem deixar o dado envelhecer.
    staleTime: STALE_TIME.operacao,
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
    comparison,
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
