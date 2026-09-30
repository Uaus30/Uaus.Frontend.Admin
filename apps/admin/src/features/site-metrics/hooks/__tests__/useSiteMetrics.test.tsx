import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteMetricsOverviewDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetSiteMetricsOverview: vi.fn(), useGetSiteApiAccess: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetSiteMetricsOverview: mocks.useGetSiteMetricsOverview,
  useGetSiteApiAccess: mocks.useGetSiteApiAccess,
}));

const { useSiteMetrics, SITE_METRICS_REFRESH_MS } = await import("../useSiteMetrics");

const totals = {
  visitors: 3,
  sessions: 4,
  pageViews: 9,
  productViews: 2,
  searches: 1,
  reserveClicks: 1,
  contactClicks: 0,
  distinctIps: 3,
  medianSessionMs: 15_000,
  sessionsWithProduct: 1,
  sessionsWithReserve: 1,
  mobileSessions: 3,
  desktopSessions: 1,
  tabletSessions: 0,
};

const OVERVIEW: SiteMetricsOverviewDto = {
  startDate: "2026-09-29",
  endDate: "2026-09-30",
  activeVisitors: 1,
  today: totals,
  period: totals,
  periodFromDailyRows: false,
  days: [
    {
      date: "2026-09-29",
      visitors: 2,
      sessions: 3,
      pageViews: 6,
      reserveClicks: 1,
      distinctIps: 2,
      isLive: false,
    },
    {
      date: "2026-09-30",
      visitors: 1,
      sessions: 1,
      pageViews: 3,
      reserveClicks: 0,
      distinctIps: 1,
      isLive: true,
    },
  ],
  topPages: [],
  topProducts: [],
  sources: [],
  topIps: [],
  topSearches: [],
};

describe("useSiteMetrics", () => {
  beforeEach(() => {
    mocks.useGetSiteApiAccess.mockReset();
    mocks.useGetSiteApiAccess.mockReturnValue({
      data: {
        startDate: "2026-09-29",
        endDate: "2026-09-30",
        requests: 12,
        distinctIps: 2,
        suspiciousIps: 1,
        days: [],
        topIps: [],
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    mocks.useGetSiteMetricsOverview.mockReset();
    mocks.useGetSiteMetricsOverview.mockReturnValue({
      data: OVERVIEW,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("pede 30 dias por padrão, contando hoje, e se atualiza sozinho a cada minuto", () => {
    renderHook(() => useSiteMetrics());

    const [params, options] = mocks.useGetSiteMetricsOverview.mock.calls[0]!;
    expect(params.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 30 dias contando hoje: 29 dias de diferença entre as pontas.
    const diff = (Date.parse(params.endDate) - Date.parse(params.startDate)) / 86_400_000;
    expect(diff).toBe(29);
    expect(options.query.refetchInterval).toBe(SITE_METRICS_REFRESH_MS);
  });

  it("trocar o período refaz o intervalo", () => {
    const { result } = renderHook(() => useSiteMetrics());

    act(() => result.current.setDays(7));

    const [params] = mocks.useGetSiteMetricsOverview.mock.calls.at(-1)!;
    const diff = (Date.parse(params.endDate) - Date.parse(params.startDate)) / 86_400_000;
    expect(diff).toBe(6);
    expect(result.current.periodLabel).toBe("Últimos 7 dias");
  });

  it("entrega a série do gráfico com o dia ao vivo marcado", () => {
    const { result } = renderHook(() => useSiteMetrics());

    expect(result.current.series).toHaveLength(2);
    expect(result.current.series[1]).toMatchObject({ date: "2026-09-30", visitors: 1, isLive: true });
    expect(result.current.overview?.activeVisitors).toBe(1);
  });

  it("pede os acessos à API com o mesmo período e o mesmo ritmo", () => {
    const { result } = renderHook(() => useSiteMetrics());

    const [overviewParams] = mocks.useGetSiteMetricsOverview.mock.calls[0]!;
    const [accessParams, accessOptions] = mocks.useGetSiteApiAccess.mock.calls[0]!;
    expect(accessParams).toEqual(overviewParams);
    expect(accessOptions.query.refetchInterval).toBe(SITE_METRICS_REFRESH_MS);
    expect(result.current.apiAccess?.requests).toBe(12);
  });

  it("atualizar agora recarrega as duas consultas", async () => {
    const { result } = renderHook(() => useSiteMetrics());

    await act(() => result.current.refetch());

    const overviewRefetch = mocks.useGetSiteMetricsOverview.mock.results[0]!.value.refetch;
    const accessRefetch = mocks.useGetSiteApiAccess.mock.results[0]!.value.refetch;
    expect(overviewRefetch).toHaveBeenCalledTimes(1);
    expect(accessRefetch).toHaveBeenCalledTimes(1);
  });
});
