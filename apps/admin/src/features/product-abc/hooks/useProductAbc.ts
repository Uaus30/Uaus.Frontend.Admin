import * as React from "react";
import { ABC_CRITERION, useGetProductAbc } from "@workspace/api-client-react";
import type { AbcClass, AbcCriterion, ProductAbcItemDto } from "@workspace/api-client-react";
import { resolveCustom, resolvePreset } from "@/features/dashboard/utils";
import type { PeriodMode, PeriodPreset } from "@/features/dashboard/types";

export const ABC_CRITERION_LABELS: Record<AbcCriterion, string> = {
  [ABC_CRITERION.Revenue]: "Faturamento",
  [ABC_CRITERION.Profit]: "Lucro",
  [ABC_CRITERION.Quantity]: "Quantidade vendida",
};

/**
 * O recorte da tabela. Sai da matriz e dos achados: clicar numa célula ou num
 * card é o que estreita a lista, em vez de mais um filtro no topo.
 */
export type AbcFocus =
  | { tipo: "todos" }
  | { tipo: "classe"; classe: AbcClass }
  | { tipo: "celula"; receita: AbcClass; lucro: AbcClass }
  | { tipo: "achado"; chave: AbcFindingKey; ids: number[] };

export type AbcFindingKey = "revenueTraps" | "hiddenGems" | "tailThatPullsBasket" | "misplacedStock";

/**
 * Estado da curva ABC.
 *
 * O período e o critério vão ao SERVIDOR — os dois mudam a classificação de
 * todo mundo, e recortar depois deixaria a classe A da tela sendo a classe A de
 * outro recorte. O foco (célula, classe, achado) é local: ele só estreita a
 * lista já classificada.
 */
export function useProductAbc() {
  // 90 dias, e não os 30 do desempenho de fornecedores: numa loja de variedades
  // a maior parte do catálogo vende poucas vezes por trimestre, e um mês só
  // produziria uma curva de ruído.
  const [preset, setPreset] = React.useState<PeriodPreset>("90d");
  const [periodMode, setPeriodMode] = React.useState<PeriodMode>("preset");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [criterion, setCriterion] = React.useState<AbcCriterion>(ABC_CRITERION.Revenue);
  const [focus, setFocus] = React.useState<AbcFocus>({ tipo: "todos" });
  const [search, setSearch] = React.useState("");

  const period = React.useMemo(
    () =>
      periodMode === "custom" && customStart && customEnd
        ? resolveCustom(customStart, customEnd)
        : resolvePreset(preset),
    [periodMode, preset, customStart, customEnd],
  );

  const query = useGetProductAbc({
    startDate: period.startDate,
    endDate: period.endDate,
    criterion,
  });

  const report = query.data;

  const products = React.useMemo(() => {
    const lista = report?.products ?? [];
    const termo = search.trim().toLowerCase();

    const noFoco = lista.filter((produto) => cabeNoFoco(produto, focus));
    if (!termo) return noFoco;

    return noFoco.filter(
      (produto) =>
        produto.productName.toLowerCase().includes(termo) ||
        produto.barcode.includes(termo) ||
        (produto.supplierName ?? "").toLowerCase().includes(termo),
    );
  }, [report, focus, search]);

  /**
   * Onde o acumulado cruza 95% — o começo da cauda no eixo de produtos.
   *
   * Sai da curva já recebida, e não de mais um campo do contrato: é uma leitura
   * do mesmo dado, e duplicá-la no servidor criaria duas verdades sobre o mesmo
   * ponto.
   */
  const tailStartsAt = React.useMemo(() => {
    const ponto = report?.curve.find((x) => x.revenueShare >= 95);
    return ponto?.productShare ?? null;
  }, [report]);

  function toggleFocus(proximo: AbcFocus) {
    setFocus((atual) => (mesmoFoco(atual, proximo) ? { tipo: "todos" } : proximo));
  }

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

    criterion,
    setCriterion,
    focus,
    toggleFocus,
    clearFocus: () => setFocus({ tipo: "todos" }),
    search,
    setSearch,

    report,
    products,
    tailStartsAt,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

function cabeNoFoco(produto: ProductAbcItemDto, foco: AbcFocus): boolean {
  switch (foco.tipo) {
    case "classe":
      return produto.class === foco.classe;
    case "celula":
      return produto.revenueClass === foco.receita && produto.profitClass === foco.lucro;
    case "achado":
      return foco.ids.includes(produto.productId);
    default:
      return true;
  }
}

/** Clicar de novo no mesmo alvo desfaz o filtro, em vez de reaplicá-lo. */
function mesmoFoco(a: AbcFocus, b: AbcFocus): boolean {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === "classe" && b.tipo === "classe") return a.classe === b.classe;
  if (a.tipo === "celula" && b.tipo === "celula") return a.receita === b.receita && a.lucro === b.lucro;
  if (a.tipo === "achado" && b.tipo === "achado") return a.chave === b.chave;
  return a.tipo === "todos";
}
