import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetPurchaseBudget: vi.fn(),
  useGetFinancialReportSummary: vi.fn(),
  useGetCapitalContributions: vi.fn(),
  useGetCapitalContributionTotalsByPartner: vi.fn(),
  useGetFinancialClosings: vi.fn(),
}));

// Só o que fala com a rede é dublado; as chaves de cache vêm do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchaseBudget: mocks.useGetPurchaseBudget,
  useGetFinancialReportSummary: mocks.useGetFinancialReportSummary,
  useGetCapitalContributions: mocks.useGetCapitalContributions,
  useGetCapitalContributionTotalsByPartner: mocks.useGetCapitalContributionTotalsByPartner,
  useGetFinancialClosings: mocks.useGetFinancialClosings,
}));

const { useFinancialDashboard, HISTORY_SIZE } = await import("../useFinancialDashboard");

/** Resposta mínima de uma query do React Query. */
function query<T>(data: T) {
  return { data, isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn() };
}

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFinancialDashboard", () => {
  const originalTimeZone = process.env.TZ;

  beforeEach(() => {
    vi.clearAllMocks();
    // 30/11/2026 às 23h30: no UTC já é dezembro. O mês do painel é o LOCAL.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 30, 23, 30));
    mocks.useGetPurchaseBudget.mockReturnValue(query({ month: "2026-11", band: "Green" }));
    mocks.useGetFinancialReportSummary.mockReturnValue(query(undefined));
    mocks.useGetCapitalContributions.mockReturnValue(query(undefined));
    mocks.useGetCapitalContributionTotalsByPartner.mockReturnValue(query(undefined));
    mocks.useGetFinancialClosings.mockReturnValue(
      query({ data: [], page: 1, limit: 12, total: 0, totalPages: 0 }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("abre no mês corrente e pede a faixa, os aportes e o resumo do mês cheio", () => {
    const { result } = renderHook(() => useFinancialDashboard(), { wrapper: createWrapper() });

    expect(result.current.month).toBe("2026-11");
    expect(mocks.useGetPurchaseBudget).toHaveBeenCalledWith({ month: "2026-11" });
    expect(mocks.useGetCapitalContributions).toHaveBeenCalledWith({ month: "2026-11" });
    expect(mocks.useGetFinancialReportSummary).toHaveBeenCalledWith({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    });
    expect(mocks.useGetFinancialClosings).toHaveBeenCalledWith({ page: 1, limit: HISTORY_SIZE });
  });

  it("troca de mês e não passa do corrente", () => {
    const { result } = renderHook(() => useFinancialDashboard(), { wrapper: createWrapper() });

    act(() => result.current.setMonth("2026-10"));
    expect(result.current.month).toBe("2026-10");
    expect(mocks.useGetPurchaseBudget).toHaveBeenLastCalledWith({ month: "2026-10" });
    expect(mocks.useGetFinancialReportSummary).toHaveBeenLastCalledWith({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    });

    act(() => result.current.setMonth("2027-01"));
    expect(result.current.month).toBe("2026-11");
  });

  it("abre no mês certo também com o processo em UTC (o fuso do CI)", () => {
    process.env.TZ = "UTC";
    vi.setSystemTime(new Date(2026, 10, 30, 12, 0));

    const { result } = renderHook(() => useFinancialDashboard(), { wrapper: createWrapper() });

    expect(result.current.month).toBe("2026-11");
  });

  it("devolve o histórico e o acumulado vazios enquanto não chegam", () => {
    mocks.useGetFinancialClosings.mockReturnValue(query(undefined));

    const { result } = renderHook(() => useFinancialDashboard(), { wrapper: createWrapper() });

    expect(result.current.closings).toEqual([]);
    expect(result.current.partnerTotals).toEqual([]);
  });
});
