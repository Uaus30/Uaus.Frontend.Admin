import * as React from "react";
import { useGetLatestProductPerformance, useGetProductPerformance } from "@workspace/api-client-react";
import type { ProductActionCode, ProductPerformanceItemDto } from "@workspace/api-client-react";
import { resolveCustom, resolvePreset } from "@/features/dashboard/utils";
import type { PeriodMode, PeriodPreset } from "@/features/dashboard/types";

/** Quantos produtos cada ranking traz. O pedido do dono: os cem melhores e os cem piores. */
export const RANKING_SIZE = 100;

/**
 * Estado da tela de desempenho de produtos.
 *
 * O período vai ao SERVIDOR: ele muda as réguas da loja (giro, margem e lucro
 * médio) e, com elas, a nota de todo mundo. Recortar depois deixaria a nota da
 * tela sendo a nota de outro período.
 *
 * A busca e a ação em foco são LOCAIS — só estreitam as duas listas que já
 * chegaram classificadas. Clicar de novo no mesmo card desfaz o recorte, como na
 * curva ABC.
 */
export function useProductPerformance() {
  // Noventa dias, a mesma janela da curva ABC: numa loja de variedades a maior
  // parte do catálogo vende poucas vezes por trimestre, e um mês só produziria
  // um ranking de ruído — com o agravante de que aqui o ruído vira ordem de
  // queimar estoque.
  const [preset, setPreset] = React.useState<PeriodPreset>("90d");
  const [periodMode, setPeriodMode] = React.useState<PeriodMode>("preset");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [action, setAction] = React.useState<ProductActionCode | null>(null);

  const period = React.useMemo(
    () =>
      periodMode === "custom" && customStart && customEnd
        ? resolveCustom(customStart, customEnd)
        : resolvePreset(preset),
    [periodMode, preset, customStart, customEnd],
  );

  /**
   * O período PADRÃO lê a apuração diária; qualquer outro calcula ao vivo.
   *
   * Medido em 13/09/2026 com 888 produtos: ~340 ms contra ~1.190 ms. A conta é a
   * MESMA dos dois lados — a apuração é produzida pelo mesmo serviço —, então os
   * dois caminhos não podem divergir por implementação, só por idade. É por isso
   * que a tela mostra de quando é a foto em vez de esconder a diferença.
   *
   * Só o preset de 90 dias entra aqui: é a janela que o worker apura. Trocar
   * para 30 dias ou para um intervalo escolhido muda as réguas da loja e
   * reclassifica todo mundo, e aí não há foto que sirva.
   */
  const usaApuracao = periodMode === "preset" && preset === "90d";

  const apuracao = useGetLatestProductPerformance(RANKING_SIZE, {
    query: { enabled: usaApuracao },
  });

  const aoVivo = useGetProductPerformance(
    { startDate: period.startDate, endDate: period.endDate, limit: RANKING_SIZE },
    { query: { enabled: !usaApuracao } },
  );

  const query = usaApuracao ? apuracao : aoVivo;
  const report = query.data;

  const best = React.useMemo(() => recortar(report?.best, search, action), [report, search, action]);
  const worst = React.useMemo(() => recortar(report?.worst, search, action), [report, search, action]);

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

    search,
    setSearch,
    action,
    toggleAction: (proxima: ProductActionCode) => setAction((atual) => (atual === proxima ? null : proxima)),
    clearFocus: () => {
      setAction(null);
      setSearch("");
    },

    report,
    best,
    worst,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Aplica busca e foco a um dos rankings.
 *
 * O foco vem da AÇÃO gravada na própria linha, e não de uma lista de ids devolvida
 * junto com os cards. Os dois caminhos dariam o mesmo resultado hoje e
 * divergiriam no dia em que a regra da ação mudasse só de um lado — o card
 * dizendo "23 produtos" e a tabela mostrando 19.
 */
function recortar(
  lista: ProductPerformanceItemDto[] | undefined,
  busca: string,
  acao: ProductActionCode | null,
): ProductPerformanceItemDto[] {
  if (!lista) return [];

  const termo = busca.trim().toLowerCase();

  return lista.filter((produto) => {
    if (acao && produto.action !== acao) return false;
    if (!termo) return true;

    return (
      produto.productName.toLowerCase().includes(termo) ||
      produto.barcode.includes(termo) ||
      (produto.categoryName ?? "").toLowerCase().includes(termo) ||
      (produto.supplierName ?? "").toLowerCase().includes(termo)
    );
  });
}
