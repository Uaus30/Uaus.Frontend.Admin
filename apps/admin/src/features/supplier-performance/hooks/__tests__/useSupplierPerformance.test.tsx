import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupplierPerformanceDto, SupplierPerformanceReportDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetSupplierPerformance: vi.fn() }));

// Dubla só o hook que fala com a REDE. As chaves de cache continuam vindo do
// api-client — um mock que redefine a chave valida a invenção do próprio mock,
// e a quebra real passa batida.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetSupplierPerformance: mocks.useGetSupplierPerformance,
}));

import { useSupplierPerformance } from "../useSupplierPerformance";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function fornecedor(overrides: Partial<SupplierPerformanceDto>): SupplierPerformanceDto {
  return {
    supplierId: 1,
    supplierName: "Fornecedor",
    avatarColor: "#6366f1",
    isRecurring: false,
    isMarketplace: false,
    sales: 10,
    units: 20,
    distinctProducts: 5,
    revenue: 1000,
    profit: 400,
    margin: 40,
    averageTicket: 100,
    revenueShare: 50,
    profitShare: 50,
    revenueChangePercent: null,
    stockUnits: 100,
    stockCost: 500,
    turnover: 16.7,
    coverageDays: 150,
    stockReturn: 0.8,
    totalProducts: 10,
    judgedProducts: 8,
    goodProducts: 2,
    lowMarginProducts: 3,
    stalledProducts: 3,
    newProducts: 1,
    inactiveProducts: 1,
    hitRate: 25,
    stalledStockCost: 120,
    lastSaleDate: "2026-09-05T10:00:00",
    daysWithoutSelling: 1,
    lastPurchaseDate: "2026-08-31T00:00:00",
    daysWithoutBuying: 6,
    purchaseCountLastYear: 12,
    purchaseTotalLastYear: 5000,
    averagePurchaseIntervalDays: 30,
    repricedProducts: 0,
    averageCostIncreasePercent: null,
    score: 50,
    scoreBreakdown: { hitRate: 50, margin: 96, turnover: 67, result: 100 },
    dailyRevenue: [0, 10, 0],
    ...overrides,
  };
}

const RELATORIO: SupplierPerformanceReportDto = {
  startDate: "2026-08-08T00:00:00",
  endDate: "2026-09-06T00:00:00",
  periodDays: 30,
  parameters: {
    turnoverTarget: 25,
    hitRateTarget: 45,
    goodMarginThreshold: 40,
    newProductDays: 21,
    healthyCoverageDays: 90,
    hitRateWeight: 0.3,
    marginWeight: 0.25,
    turnoverWeight: 0.25,
    resultWeight: 0.2,
    storeHitRate: 26.5,
    storeMargin: 41.7,
    averageProfitPerSupplier: 200,
  },
  totals: {
    revenue: 2000,
    previousRevenue: 1500,
    profit: 800,
    margin: 40,
    sales: 30,
    units: 60,
    stockCost: 1000,
    stalledStockCost: 200,
    activeSuppliers: 2,
    totalSuppliers: 3,
    goodProducts: 4,
    judgedProducts: 16,
  },
  suppliers: [
    fornecedor({
      supplierId: 1,
      supplierName: "Shopee",
      score: 73,
      revenue: 1500,
      profit: 700,
      margin: 46.6,
      hitRate: 33,
    }),
    fornecedor({
      supplierId: 2,
      supplierName: "Nossa Casa",
      score: 48,
      revenue: 500,
      profit: 100,
      margin: 20,
      hitRate: 12,
    }),
    fornecedor({
      supplierId: 3,
      supplierName: "Max Atacadista",
      score: 0,
      sales: 0,
      revenue: 0,
      profit: 0,
      margin: 0,
      hitRate: 0,
      revenueShare: 0,
      dailyRevenue: [0, 0, 0],
    }),
  ],
};

describe("useSupplierPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetSupplierPerformance.mockReturnValue({
      data: RELATORIO,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("abre em 30 dias e pede o recorte ao servidor", async () => {
    const { result } = renderHook(() => useSupplierPerformance(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.report).toBeDefined());

    // O período tem que ir ao SERVIDOR: a nota é comparativa, medida contra as
    // médias do conjunto, e recortar depois compararia cada fornecedor com uma
    // loja que a tela não está mostrando.
    expect(mocks.useGetSupplierPerformance).toHaveBeenCalledWith(
      expect.objectContaining({
        onlyRecurring: false,
        startDate: expect.any(String),
        endDate: expect.any(String),
      }),
    );
    expect(result.current.period.label).toBe("Últimos 30 dias");
  });

  it("o filtro de recorrentes vai ao servidor, e não à lista já recebida", async () => {
    const { result } = renderHook(() => useSupplierPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.setOnlyRecurring(true));

    await waitFor(() =>
      expect(mocks.useGetSupplierPerformance).toHaveBeenCalledWith(
        expect.objectContaining({ onlyRecurring: true }),
      ),
    );
  });

  it("esconder quem não vendeu não promove ninguém no ranking de lucro", async () => {
    const { result } = renderHook(() => useSupplierPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    expect(result.current.suppliers).toHaveLength(3);
    expect(result.current.profitRanking.total).toBe(2);

    act(() => result.current.setShowWithoutSales(false));

    expect(result.current.suppliers.map((x) => x.supplierId)).toEqual([1, 2]);
    // As posições saem da lista COMPLETA de ativos: o filtro é de exibição.
    expect(result.current.profitRanking.posicoes.get(1)).toBe(1);
    expect(result.current.profitRanking.posicoes.get(2)).toBe(2);
    expect(result.current.profitRanking.total).toBe(2);
  });

  it("ordenar por margem não deixa quem não vendeu competir pela pior", async () => {
    const { result } = renderHook(() => useSupplierPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.setSort("margin"));

    // Margem zero por AUSÊNCIA de venda não é desempenho: quem não vendeu vai
    // para o fim, senão o topo da lista encheria de linha vazia.
    expect(result.current.suppliers.map((x) => x.supplierId)).toEqual([1, 2, 3]);

    act(() => result.current.setSort("revenue"));
    expect(result.current.suppliers.map((x) => x.revenue)).toEqual([1500, 500, 0]);
  });
});
