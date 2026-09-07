import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPerformanceItemDto, ProductPerformanceReportDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetProductPerformance: vi.fn() }));

// Dubla só o hook que fala com a REDE. As chaves de cache continuam vindo do
// api-client — um mock que redefine a chave valida a invenção do próprio mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetProductPerformance: mocks.useGetProductPerformance,
}));

import { useProductPerformance, RANKING_SIZE } from "../useProductPerformance";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function produto(overrides: Partial<ProductPerformanceItemDto>): ProductPerformanceItemDto {
  return {
    productId: 1,
    productGroupId: 1,
    productName: "PRODUTO",
    barcode: "1",
    categoryName: "Utilidades",
    supplierName: "Shopee",
    rank: 1,
    units: 10,
    sales: 5,
    revenue: 100,
    profit: 40,
    margin: 40,
    price: 10,
    costPrice: 6,
    stock: 10,
    stockCost: 60,
    sellThrough: 50,
    coverageDays: 90,
    weeksWithSales: 8,
    frequency: "Constant",
    lastSaleAt: "2026-09-05T10:00:00",
    daysWithoutSelling: 2,
    daysInStore: 200,
    score: 80,
    scoreBreakdown: { turnover: 100, margin: 100, result: 60, consistency: 50 },
    class: "Standout",
    action: "Replicate",
    capitalAtRisk: 12,
    missedProfit: 0,
    ...overrides,
  };
}

const RELATORIO: ProductPerformanceReportDto = {
  startDate: "2026-06-10T00:00:00",
  endDate: "2026-09-07T00:00:00",
  periodDays: 90,
  parameters: {
    turnoverWeight: 0.3,
    marginWeight: 0.25,
    resultWeight: 0.25,
    consistencyWeight: 0.2,
    standoutScore: 70,
    steadyScore: 40,
    goodScore: 60,
    lowMarginThreshold: 30,
    healthyMarginThreshold: 40,
    shortCoverageDays: 21,
    excessCoverageDays: 365,
    newProductDays: 21,
    storeSellThrough: 23.17,
    storeMargin: 39.78,
    averageProfitPerProduct: 18.78,
  },
  totals: {
    products: 896,
    soldProducts: 497,
    stalledProducts: 123,
    newProducts: 276,
    revenue: 23458.48,
    profit: 9332.49,
    margin: 39.78,
    units: 3102,
    sales: 1200,
    stockUnits: 10065,
    stockCost: 30590.58,
    stalledStockCost: 3487.8,
    capitalAtRisk: 15874.51,
    sellThrough: 23.17,
  },
  comparison: {
    best: {
      products: 2,
      units: 120,
      revenue: 2000,
      profit: 800,
      margin: 40,
      stockCost: 200,
      capitalAtRisk: 20,
      sellThrough: 60,
      averageScore: 90,
      profitShare: 64,
      stockCostShare: 24,
    },
    worst: {
      products: 2,
      units: 1,
      revenue: 10,
      profit: 2,
      margin: 20,
      stockCost: 900,
      capitalAtRisk: 700,
      sellThrough: 1,
      averageScore: 12,
      profitShare: 4,
      stockCostShare: 31,
    },
  },
  suggestions: [
    { action: "RaisePrice", products: 23, amount: 330.47, revenue: 900, profit: 100, stockCost: 300 },
    { action: "Restock", products: 95, amount: 3129.89, revenue: 3129.89, profit: 900, stockCost: 200 },
    { action: "Replicate", products: 112, amount: 4301.83, revenue: 9000, profit: 4301.83, stockCost: 900 },
    { action: "Burn", products: 223, amount: 12732.83, revenue: 100, profit: 10, stockCost: 12732.83 },
  ],
  best: [
    produto({ productId: 1, productName: "CAMISETA DO BRASIL", action: "Replicate", rank: 1 }),
    produto({
      productId: 2,
      productName: "CHINELO ADULTO",
      supplierName: "Master",
      action: "Restock",
      rank: 2,
    }),
  ],
  worst: [
    produto({
      productId: 3,
      productName: "JARRA DE PLASTICO",
      class: "Weak",
      action: "Burn",
      score: 10,
      units: 1,
      capitalAtRisk: 525.84,
      rank: 1,
    }),
    produto({
      productId: 4,
      productName: "CHAPEU PESCADOR",
      class: "Stalled",
      action: "Burn",
      score: 0,
      units: 0,
      capitalAtRisk: 104.4,
      rank: 2,
    }),
  ],
};

describe("useProductPerformance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetProductPerformance.mockReturnValue({
      data: RELATORIO,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("abre em 90 dias e pede os cem de cada lado ao servidor", async () => {
    const { result } = renderHook(() => useProductPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    // Noventa dias, a mesma janela da curva ABC: um mês só classificaria ruído —
    // com o agravante de que aqui o ruído vira ordem de queimar estoque.
    expect(result.current.period.label).toBe("Últimos 90 dias");
    expect(mocks.useGetProductPerformance).toHaveBeenCalledWith(
      expect.objectContaining({ limit: RANKING_SIZE }),
    );
  });

  it("o período vai ao servidor, e não à lista já pontuada", async () => {
    const { result } = renderHook(() => useProductPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.handleSelectPreset("30d"));

    // O período muda as réguas da loja (giro, margem, lucro médio) e com elas a
    // nota de todo mundo; recortar no cliente deixaria a nota da tela sendo a
    // nota de outro período.
    await waitFor(() => expect(result.current.period.label).toBe("Últimos 30 dias"));
    expect(mocks.useGetProductPerformance).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: result.current.period.startDate }),
    );
  });

  it("a ação recorta os DOIS rankings, e clicar de novo desfaz", async () => {
    const { result } = renderHook(() => useProductPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.toggleAction("Burn"));
    expect(result.current.best).toHaveLength(0);
    expect(result.current.worst.map((x) => x.productId)).toEqual([3, 4]);

    act(() => result.current.toggleAction("Burn"));
    expect(result.current.best).toHaveLength(2);
    expect(result.current.worst).toHaveLength(2);
  });

  it("o recorte usa a ação gravada na linha, e não uma lista de ids à parte", async () => {
    const { result } = renderHook(() => useProductPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.toggleAction("Restock"));

    // Uma lista de ids devolvida junto com o card daria o mesmo resultado hoje e
    // divergiria no dia em que a regra da ação mudasse só de um lado.
    expect(result.current.best.map((x) => x.productName)).toEqual(["CHINELO ADULTO"]);
  });

  it("a busca soma ao recorte e alcança fornecedor", async () => {
    const { result } = renderHook(() => useProductPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.setSearch("master"));
    expect(result.current.best.map((x) => x.productId)).toEqual([2]);

    act(() => result.current.toggleAction("Replicate"));
    expect(result.current.best).toHaveLength(0);

    act(() => result.current.clearFocus());
    expect(result.current.best).toHaveLength(2);
    expect(result.current.search).toBe("");
  });

  it("a busca alcança os dois rankings ao mesmo tempo", async () => {
    const { result } = renderHook(() => useProductPerformance(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.setSearch("jarra"));

    expect(result.current.best).toHaveLength(0);
    expect(result.current.worst.map((x) => x.productName)).toEqual(["JARRA DE PLASTICO"]);
  });
});
