import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteMetricsOverviewDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetSiteMetricsOverview: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetSiteMetricsOverview: mocks.useGetSiteMetricsOverview,
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
});
