import * as React from "react";
import {
  COMPARISON_DIMENSION,
  useGetPeriodComparison,
  type ComparisonDimension,
  type DimensionChangeDto,
} from "@workspace/api-client-react";
import {
  DEFAULT_COMPARISON_PRESET,
  normalizeRange,
  resolveComparisonPreset,
  type ComparisonPreset,
  type ComparisonRange,
} from "../lib/comparison";

/** Por qual coluna a tabela de "quem mudou" está ordenada. */
export type ChangeSort = {
  coluna: "delta" | "previousRevenue" | "currentRevenue" | "currentUnits" | "currentAveragePrice";
  ordem: "asc" | "desc";
};

/**
 * Estado da tela "O que mudou".
 *
 * <b>Os dois períodos e a dimensão vão ao SERVIDOR</b> — trocar qualquer um dos
 * três refaz a subtração inteira, e recortar no cliente devolveria linhas de um
 * recorte com os totais de outro. A ordenação da tabela é local, sobre as linhas
 * já carregadas: pedir outra ordem ao servidor traria outro conjunto e trocaria
 * a lista debaixo de quem está lendo (a mesma regra das outras telas de BI).
 */
export function usePeriodComparison() {
  const [preset, setPreset] = React.useState<ComparisonPreset>(DEFAULT_COMPARISON_PRESET);
  const [custom, setCustom] = React.useState<ComparisonRange | null>(null);
  const [dimension, setDimension] = React.useState<ComparisonDimension>(COMPARISON_DIMENSION.Category);
  const [sort, setSort] = React.useState<ChangeSort>({ coluna: "delta", ordem: "asc" });
  const [search, setSearch] = React.useState("");

  /**
   * Muda a cada limpeza ou troca de preset, para os calendários remontarem.
   *
   * A `key` deles deriva do intervalo, e isso basta quando o intervalo muda. Mas
   * o "X" em modo preset chama `setCustom(null)` com `custom` JÁ nulo: o React
   * aborta o re-render, a key não muda, e o gatilho fica anunciando "Selecionar
   * período" sobre uma consulta que não mudou — a mesma mentira que a key veio
   * corrigir, por um caminho que ela não cobria.
   */
  const [resetToken, setResetToken] = React.useState(0);

  const range = React.useMemo(() => custom ?? resolveComparisonPreset(preset), [custom, preset]);

  const query = useGetPeriodComparison({
    previousStartDate: range.previousStartDate,
    previousEndDate: range.previousEndDate,
    currentStartDate: range.currentStartDate,
    currentEndDate: range.currentEndDate,
    dimension,
  });

  const report = query.data;

  /**
   * O fator que mais explica a diferença — o que a tela diz em uma frase antes
   * de qualquer gráfico.
   *
   * É o de maior MÓDULO, e não o maior negativo: um período que subiu tem a
   * mesma pergunta ("o que puxou"), e responder só para quedas deixaria a tela
   * muda justamente quando a notícia é boa.
   */
  const leadingFactor = React.useMemo(() => {
    if (!report || report.bridge.length === 0) return null;

    return report.bridge.reduce((maior, atual) =>
      Math.abs(atual.amount) > Math.abs(maior.amount) ? atual : maior,
    );
  }, [report]);

  const changes = React.useMemo(() => {
    const linhas = report?.changes ?? [];
    const termo = search.trim().toLowerCase();
    const filtradas = termo ? linhas.filter((linha) => linha.name.toLowerCase().includes(termo)) : linhas;

    const sinal = sort.ordem === "asc" ? 1 : -1;

    return [...filtradas].sort((a, b) => sinal * (valorDe(a, sort.coluna) - valorDe(b, sort.coluna)));
  }, [report, search, sort]);

  /** Clicar de novo na mesma coluna inverte; coluna nova começa decrescente. */
  function ordenarPor(coluna: ChangeSort["coluna"]) {
    setSort((atual) =>
      atual.coluna === coluna
        ? { coluna, ordem: atual.ordem === "asc" ? "desc" : "asc" }
        : { coluna, ordem: coluna === "delta" ? "asc" : "desc" },
    );
  }

  return {
    range,
    preset,
    custom,
    resetToken,
    handleSelectPreset: (value: string) => {
      setPreset(value as ComparisonPreset);
      setCustom(null);
      setResetToken((atual) => atual + 1);
    },
    // Normaliza antes de guardar: o que sai daqui nunca sobrepõe, e por isso a
    // API nunca precisa recusar o que o calendário montou. `fixo` diz qual lado
    // o usuário acabou de escolher — é o que não se mexe.
    handleApplyCustom: (proximo: ComparisonRange, fixo: "previous" | "current" = "current") => {
      setCustom(normalizeRange(proximo, fixo));
      setResetToken((atual) => atual + 1);
    },
    handleClearCustom: () => {
      setCustom(null);
      setResetToken((atual) => atual + 1);
    },

    dimension,
    setDimension,
    sort,
    ordenarPor,
    search,
    setSearch,

    report,
    changes,
    leadingFactor,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

function valorDe(linha: DimensionChangeDto, coluna: ChangeSort["coluna"]): number {
  switch (coluna) {
    case "previousRevenue":
      return linha.previousRevenue;
    case "currentRevenue":
      return linha.currentRevenue;
    case "currentUnits":
      return linha.currentUnits;
    case "currentAveragePrice":
      return linha.currentAveragePrice;
    default:
      return linha.revenueDelta;
  }
}
