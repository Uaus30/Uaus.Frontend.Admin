import * as React from "react";
import { useGetSiteApiAccess, useGetSiteMetricsOverview } from "@workspace/api-client-react";
import {
  DEFAULT_SITE_PERIOD,
  resolveSitePeriod,
  SITE_PERIODS,
  type SitePeriodDays,
} from "../lib/site-metrics";

/** De quanto em quanto tempo a tela se atualiza sozinha: "tem alguém no site agora?" precisa de resposta fresca. */
export const SITE_METRICS_REFRESH_MS = 60_000;

/**
 * Estado da tela BI › Site.
 *
 * O período vai ao SERVIDOR e é sempre "os últimos N dias contando hoje": a
 * pergunta do dono é "como está agora e como estava", não um recorte
 * arbitrário do passado. Hoje e os últimos 30 minutos vêm ao vivo em qualquer
 * período, e a consulta se refaz sozinha a cada minuto enquanto a tela está
 * aberta — como o cartão "hoje" do painel, porque aqui "agora" é a pergunta.
 */
export function useSiteMetrics() {
  const [days, setDays] = React.useState<SitePeriodDays>(DEFAULT_SITE_PERIOD);

  const range = React.useMemo(() => resolveSitePeriod(days), [days]);

  const query = useGetSiteMetricsOverview(range, {
    query: { refetchInterval: SITE_METRICS_REFRESH_MS, refetchOnWindowFocus: true },
  });

  // A segunda pergunta — quem bate na API sem token — vem de outra tabela e
  // outra rotina (gravada a cada minuto), por isso é outra consulta, com o
  // mesmo período e o mesmo ritmo de atualização.
  const apiAccessQuery = useGetSiteApiAccess(range, {
    query: { refetchInterval: SITE_METRICS_REFRESH_MS, refetchOnWindowFocus: true },
  });

  const overview = query.data;

  /** A série diária pronta para o gráfico: rótulo curto e o dia ao vivo marcado. */
  const series = React.useMemo(
    () =>
      (overview?.days ?? []).map((day) => ({
        date: day.date,
        visitors: day.visitors,
        sessions: day.sessions,
        pageViews: day.pageViews,
        reserveClicks: day.reserveClicks,
        isLive: day.isLive,
      })),
    [overview],
  );

  return {
    days,
    setDays,
    periodLabel: SITE_PERIODS.find((p) => p.days === days)?.label ?? "",
    overview,
    series,
    apiAccess: apiAccessQuery.data,
    isApiAccessError: apiAccessQuery.isError,
    isLoading: query.isLoading,
    // "Atualizar agora" e o giro do botão cobrem as DUAS consultas: o dono clica
    // para conferir se um IP suspeito continua batendo, e dado de 60 s atrás na
    // seção de acessos com o botão parado leria como "atualizou".
    isFetching: query.isFetching || apiAccessQuery.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => Promise.all([query.refetch(), apiAccessQuery.refetch()]),
  };
}
