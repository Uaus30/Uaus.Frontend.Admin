import * as React from "react";
import { useGetSupplierPerformanceDetail } from "@workspace/api-client-react";
import type { SupplierProductPerformanceDto } from "@workspace/api-client-react";
import { resolveCustom, resolvePreset } from "@/features/dashboard/utils";
import type { PeriodMode, PeriodPreset } from "@/features/dashboard/types";

/** Quantas linhas cada lista mostra antes de oferecer "ver todos". */
const LIMITE_DA_LISTA = 8;

/**
 * A análise de um fornecedor.
 *
 * O período nasce igual ao do ranking (30 dias) e é reescolhido aqui: quem
 * chega pelo card quer ver o MESMO recorte, e quem quer outro muda na própria
 * tela sem voltar.
 */
export function useSupplierDetail(supplierId: number | null) {
  const [preset, setPreset] = React.useState<PeriodPreset>("30d");
  const [periodMode, setPeriodMode] = React.useState<PeriodMode>("preset");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");

  const period = React.useMemo(
    () =>
      periodMode === "custom" && customStart && customEnd
        ? resolveCustom(customStart, customEnd)
        : resolvePreset(preset),
    [periodMode, preset, customStart, customEnd],
  );

  const query = useGetSupplierPerformanceDetail(supplierId, {
    startDate: period.startDate,
    endDate: period.endDate,
  });

  /**
   * As quatro listas da tela. Cada uma responde uma pergunta diferente, e é por
   * isso que são listas e não uma tabela com filtro: "o que repor" e "o que
   * encalhou" não se leem na mesma ordenação.
   */
  const listas = React.useMemo(() => {
    // A lista sai de dentro do memo: um `?? []` fora dele cria um array novo a
    // cada render e faz a dependência mudar sempre, jogando fora o memo.
    const produtos = query.data?.products ?? [];
    const bons = ordenar(produtos, "Good", (a, b) => b.profit - a.profit);
    const margemBaixa = ordenar(produtos, "LowMargin", (a, b) => a.margin - b.margin);
    const parados = ordenar(produtos, "Stalled", (a, b) => b.stockCost - a.stockCost);

    // Recompra: o que vende e vai faltar. Esgotado (cobertura zero) vem primeiro
    // — é o único caso em que a loja já está perdendo venda.
    const recompra = produtos
      .filter((x) => x.suggestedPurchase > 0)
      .sort((a, b) => (a.coverageDays ?? 0) - (b.coverageDays ?? 0));

    return { bons, margemBaixa, parados, recompra };
  }, [query.data]);

  return {
    period,
    periodMode,
    preset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    handleSelectPreset: (value: string) => {
      setPreset(value as PeriodPreset);
      setPeriodMode("preset");
      setCustomStart("");
      setCustomEnd("");
    },
    handleApplyCustom: (start?: string, end?: string) => {
      if (!start || !end) return;
      setCustomStart(start);
      setCustomEnd(end);
      setPeriodMode("custom");
    },
    handleClearCustom: () => {
      setPeriodMode("preset");
      setCustomStart("");
      setCustomEnd("");
    },

    detail: query.data,
    listas,
    limite: LIMITE_DA_LISTA,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

function ordenar(
  produtos: SupplierProductPerformanceDto[],
  classe: SupplierProductPerformanceDto["classification"],
  comparar: (a: SupplierProductPerformanceDto, b: SupplierProductPerformanceDto) => number,
) {
  return produtos.filter((x) => x.classification === classe).sort(comparar);
}
