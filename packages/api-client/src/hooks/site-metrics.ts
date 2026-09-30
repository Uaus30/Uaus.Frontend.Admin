/**
 * BI › Site (`/SiteMetrics`) — as métricas de acesso da loja online.
 *
 * Um endpoint só: hoje ao vivo, o período pedido, a série diária e as listas
 * saem do mesmo varrimento. Campo anulável é declarado opcional: com
 * `WhenWritingNull` o nulo não chega como `null`, o campo simplesmente não vem.
 *
 * A GRAVAÇÃO dos eventos não passa por aqui: é o coletor do site
 * (`apps/loja/src/lib/metrics/`), anônimo. Este arquivo só lê.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";

/** Os números de um período — hoje, ou o intervalo escolhido. */
export interface SiteMetricsTotalsDto {
  visitors: number;
  sessions: number;
  pageViews: number;
  productViews: number;
  searches: number;
  reserveClicks: number;
  contactClicks: number;
  distinctIps: number;
  /** Mediana do tempo visível por sessão, em ms. */
  medianSessionMs: number;
  sessionsWithProduct: number;
  sessionsWithReserve: number;
  mobileSessions: number;
  desktopSessions: number;
  tabletSessions: number;
}

/** Um ponto da série diária. */
export interface SiteMetricsDayDto {
  /** `yyyy-MM-dd`. */
  date: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  reserveClicks: number;
  distinctIps: number;
  /** Hoje (ou dia ainda não consolidado): calculado ao vivo, sujeito a crescer. */
  isLive: boolean;
}

export interface SiteMetricsPageDto {
  path: string;
  views: number;
  medianVisibleMs: number;
}

export interface SiteMetricsProductDto {
  productGroupId: number;
  name: string;
  views: number;
  reserveClicks: number;
}

/** Um rótulo e uma contagem — origem de tráfego ou termo buscado. */
export interface SiteMetricsSourceDto {
  source: string;
  sessions: number;
}

export interface SiteMetricsIpDto {
  ip: string;
  events: number;
  sessions: number;
  lastUserAgent?: string | null;
}

export interface SiteMetricsOverviewDto {
  startDate: string;
  endDate: string;
  /** Visitantes com evento nos últimos 30 minutos. */
  activeVisitors: number;
  today: SiteMetricsTotalsDto;
  period: SiteMetricsTotalsDto;
  /**
   * Verdadeiro em intervalo acima de 31 dias: totais SOMADOS das linhas diárias
   * (visitantes e sessões somados por dia, não distintos); páginas, produtos e
   * origens vêm das quebras diárias; IPs e buscas vêm vazios.
   */
  periodFromDailyRows: boolean;
  days: SiteMetricsDayDto[];
  topPages: SiteMetricsPageDto[];
  topProducts: SiteMetricsProductDto[];
  sources: SiteMetricsSourceDto[];
  topIps: SiteMetricsIpDto[];
  topSearches: SiteMetricsSourceDto[];
}

export interface SiteMetricsParams {
  /** `yyyy-MM-dd`, inclusive. Sem datas, o servidor usa os últimos 30 dias. */
  startDate?: string;
  endDate?: string;
}

/** Prefixo da chave; quem consulta acrescenta os parâmetros. */
export const getSiteMetricsOverviewQueryKey = (): QueryKey => ["site-metrics-overview"];

export async function getSiteMetricsOverview(params?: SiteMetricsParams) {
  return apiGetOrThrow<SiteMetricsOverviewDto>("/SiteMetrics/overview", {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function useGetSiteMetricsOverview(
  params?: SiteMetricsParams,
  options?: {
    query?: Omit<
      UseQueryOptions<SiteMetricsOverviewDto, ApiError, SiteMetricsOverviewDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<SiteMetricsOverviewDto, ApiError, SiteMetricsOverviewDto, QueryKey>({
    queryKey: [...getSiteMetricsOverviewQueryKey(), params ?? {}],
    queryFn: () => getSiteMetricsOverview(params),
    ...options?.query,
  });
}
