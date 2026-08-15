import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetFinancialReportSummary: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetFinancialReportSummary: mocks.useGetFinancialReportSummary,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useFinancialReports, defaultReportPeriod } = await import("../useFinancialReports");

/** Resumo mínimo devolvido pela consulta mockada. */
const summaryFixture = {
  startDate: "2026-08-01T00:00:00",
  endDate: "2026-08-08T00:00:00",
  sales: {
    revenue: 30000,
    cost: 20500,
    profit: 9000,
    discount: 500,
    marginPercentage: 30,
    salesCount: 412,
    cancelledSalesCount: 2,
    itemsCount: 1000,
    averageTicket: 72.81,
    startDate: "2026-08-01T00:00:00",
    endDate: "2026-08-08T00:00:00",
  },
  purchasesTotal: 18000,
  writeOffs: { totalCost: 300, totalQuantity: 12, byReason: [] },
  fixedCosts: { total: 4200, items: [] },
  grossProfit: 9000,
  netProfit: 4800,
  partnerDistribution: [],
  warnings: [],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFinancialReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetFinancialReportSummary.mockReturnValue({
      data: summaryFixture,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("deve iniciar com o período padrão: primeiro dia do mês atual até hoje", () => {
    const { result } = renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    expect(result.current.startDate).toBe(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    expect(result.current.endDate).toBe(format(new Date(), "yyyy-MM-dd"));
  });

  it("deve repassar o período filtrado para a consulta do resumo", () => {
    renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    const period = defaultReportPeriod();
    expect(mocks.useGetFinancialReportSummary).toHaveBeenCalledWith({
      startDate: period.startDate,
      endDate: period.endDate,
    });
  });

  it("deve expor o resumo retornado pela consulta", () => {
    const { result } = renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    expect(result.current.summary).toEqual(summaryFixture);
    expect(result.current.isLoading).toBe(false);
  });

  it("deve refazer a consulta ao mudar o período", () => {
    const { result } = renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    act(() => {
      result.current.setStartDate("2026-07-01");
      result.current.setEndDate("2026-07-31");
    });

    expect(mocks.useGetFinancialReportSummary).toHaveBeenLastCalledWith({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("deve enviar undefined quando o filtro de datas é limpo", () => {
    const { result } = renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    // Limpar o calendário devolve strings vazias — o backend assume 30 dias.
    act(() => {
      result.current.setStartDate("");
      result.current.setEndDate("");
    });

    expect(mocks.useGetFinancialReportSummary).toHaveBeenLastCalledWith({
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("deve avisar com a mensagem do backend quando a consulta falha", async () => {
    // O `ApiError` já chega com o texto do backend em `message`.
    mocks.useGetFinancialReportSummary.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: Object.assign(new Error("A data inicial não pode ser maior que a final!"), {
        status: 400,
        payload: { message: "A data inicial não pode ser maior que a final!" },
      }),
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao carregar o relatório financeiro",
          description: "A data inicial não pode ser maior que a final!",
          variant: "destructive",
        }),
      ),
    );
    // A página usa isError + error para trocar os skeletons pelo estado de erro.
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("não deve disparar toast quando a consulta responde sem erro", () => {
    renderHook(() => useFinancialReports(), { wrapper: createWrapper() });

    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
