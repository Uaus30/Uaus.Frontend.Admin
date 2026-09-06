import * as React from "react";
import { useGetSupplierPerformance } from "@workspace/api-client-react";
import type { SupplierPerformanceDto } from "@workspace/api-client-react";
// O recorte de período reaproveita o do painel de propósito. A conversão de
// data passa por `formatDateInput` e não por `toISOString()` — em UTC o dia vira
// para trás no Brasil, e uma segunda implementação aqui divergiria calada.
import { resolveCustom, resolvePreset } from "@/features/dashboard/utils";
import type { PeriodMode, PeriodPreset } from "@/features/dashboard/types";

/** Como o ranking pode ser ordenado. A nota é o padrão — é a pergunta da tela. */
export type SupplierSort = "score" | "revenue" | "margin" | "hitRate";

export const SUPPLIER_SORTS: Record<SupplierSort, string> = {
  score: "Nota (maior primeiro)",
  revenue: "Faturamento",
  margin: "Margem",
  hitRate: "Produtos bons",
};

/**
 * Estado da tela de desempenho de fornecedores.
 *
 * O período e a flag de recorrentes vão ao SERVIDOR, não ao cliente: o cálculo
 * inteiro é comparativo — margem, aproveitamento e resultado são medidos contra
 * as médias do conjunto filtrado. Filtrar depois, sobre a resposta já pronta,
 * deixaria cada nota comparada com uma loja que a tela não está mostrando.
 *
 * A ordenação, ao contrário, é local: ela não muda nenhum número, só a ordem em
 * que as mesmas linhas aparecem.
 */
export function useSupplierPerformance() {
  // 30 dias, e não os 7 do painel: fornecedor de compra mensal quase não aparece
  // numa janela de uma semana, e a nota sairia de uma amostra que não existe.
  const [preset, setPreset] = React.useState<PeriodPreset>("30d");
  const [periodMode, setPeriodMode] = React.useState<PeriodMode>("preset");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [onlyRecurring, setOnlyRecurring] = React.useState(false);
  const [showWithoutSales, setShowWithoutSales] = React.useState(true);
  const [sort, setSort] = React.useState<SupplierSort>("score");

  const period = React.useMemo(
    () =>
      periodMode === "custom" && customStart && customEnd
        ? resolveCustom(customStart, customEnd)
        : resolvePreset(preset),
    [periodMode, preset, customStart, customEnd],
  );

  const query = useGetSupplierPerformance({
    startDate: period.startDate,
    endDate: period.endDate,
    onlyRecurring,
  });

  const suppliers = React.useMemo(() => {
    const lista = query.data?.suppliers ?? [];
    const visiveis = showWithoutSales ? lista : lista.filter((x) => x.sales > 0);
    return ordenar(visiveis, sort);
  }, [query.data, showWithoutSales, sort]);

  /**
   * Ranking de LUCRO, para os motivos poderem dizer "2º maior da loja".
   *
   * Sai da lista completa e não da visível: esconder quem não vendeu não pode
   * promover ninguém de posição.
   */
  const profitRanking = React.useMemo(() => {
    const ativos = (query.data?.suppliers ?? []).filter((x) => x.sales > 0);
    const ordenados = [...ativos].sort((a, b) => b.profit - a.profit);
    const posicoes = new Map(ordenados.map((x, i) => [x.supplierId, i + 1]));
    return { posicoes, total: ativos.length };
  }, [query.data]);

  function handleSelectPreset(value: string) {
    setPreset(value as PeriodPreset);
    setPeriodMode("preset");
    setCustomStart("");
    setCustomEnd("");
  }

  /**
   * O intervalo é aplicado assim que as duas pontas existem, e por isso as datas
   * chegam por parâmetro: neste instante o estado do rascunho ainda guarda o
   * valor anterior.
   */
  function handleApplyCustom(start?: string, end?: string) {
    if (!start || !end) return;
    setCustomStart(start);
    setCustomEnd(end);
    setPeriodMode("custom");
  }

  function handleClearCustom() {
    setPeriodMode("preset");
    setCustomStart("");
    setCustomEnd("");
  }

  return {
    period,
    periodMode,
    preset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    handleSelectPreset,
    handleApplyCustom,
    handleClearCustom,

    onlyRecurring,
    setOnlyRecurring,
    showWithoutSales,
    setShowWithoutSales,
    sort,
    setSort,

    report: query.data,
    suppliers,
    profitRanking,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** A ordenação é local — nenhuma delas muda um número, só a ordem das linhas. */
function ordenar(lista: SupplierPerformanceDto[], sort: SupplierSort): SupplierPerformanceDto[] {
  const copia = [...lista];

  switch (sort) {
    case "revenue":
      return copia.sort((a, b) => b.revenue - a.revenue);
    case "margin":
      // Quem não vendeu tem margem zero por ausência de dado, não por desempenho:
      // deixá-lo competir por "menor margem" encheria o topo de linha vazia.
      return copia.sort((a, b) => Number(b.sales > 0) - Number(a.sales > 0) || b.margin - a.margin);
    case "hitRate":
      return copia.sort((a, b) => b.hitRate - a.hitRate || b.judgedProducts - a.judgedProducts);
    default:
      return copia.sort((a, b) => b.score - a.score || b.revenue - a.revenue);
  }
}
