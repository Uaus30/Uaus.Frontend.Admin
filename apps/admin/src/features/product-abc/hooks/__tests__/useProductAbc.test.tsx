import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ABC_CRITERION } from "@workspace/api-client-react";
import type { ProductAbcItemDto, ProductAbcReportDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetProductAbc: vi.fn() }));

// Dubla só o hook que fala com a REDE. As chaves de cache continuam vindo do
// api-client — um mock que redefine a chave valida a invenção do próprio mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetProductAbc: mocks.useGetProductAbc,
}));

import { useProductAbc } from "../useProductAbc";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function produto(overrides: Partial<ProductAbcItemDto>): ProductAbcItemDto {
  return {
    productId: 1,
    productGroupId: 1,
    productName: "PRODUTO",
    barcode: "1",
    categoryName: "Utilidades",
    supplierName: "Shopee",
    units: 10,
    sales: 5,
    revenue: 100,
    profit: 40,
    margin: 40,
    share: 10,
    cumulativeShare: 10,
    rank: 1,
    class: "A",
    revenueClass: "A",
    profitClass: "A",
    frequency: "Constant",
    weeksWithSales: 8,
    basketLift: 1,
    stock: 10,
    stockCost: 50,
    coverageDays: 90,
    ...overrides,
  };
}

const RELATORIO: ProductAbcReportDto = {
  startDate: "2026-06-09T00:00:00",
  endDate: "2026-09-06T00:00:00",
  periodDays: 90,
  criterion: ABC_CRITERION.Revenue,
  summary: {
    revenue: 1000,
    profit: 400,
    margin: 40,
    units: 100,
    sales: 50,
    products: 4,
    classAProducts: 2,
    classBProducts: 1,
    classCProducts: 1,
    shareOfProductsForEightyPercent: 50,
    shareFromTopFifthOfProducts: 60,
    concentrationIndex: 0.42,
    averageTicket: 20,
    stockCost: 500,
    stockCostInClassC: 120,
  },
  curve: [
    { productShare: 0, revenueShare: 0, profitShare: 0 },
    { productShare: 25, revenueShare: 60, profitShare: 30 },
    { productShare: 50, revenueShare: 80, profitShare: 55 },
    { productShare: 75, revenueShare: 96, profitShare: 90 },
    { productShare: 100, revenueShare: 100, profitShare: 100 },
  ],
  matrix: [],
  findings: {
    revenueTraps: { products: 1, revenue: 300, profit: 10, amount: 300, productIds: [2] },
    hiddenGems: { products: 1, revenue: 50, profit: 40, amount: 40, productIds: [3] },
    tailThatPullsBasket: { products: 0, revenue: 0, profit: 0, amount: 0, productIds: [] },
    misplacedStock: { products: 1, revenue: 20, profit: 5, amount: 120, productIds: [4] },
  },
  products: [
    produto({ productId: 1, productName: "CAMISETA", class: "A", revenueClass: "A", profitClass: "A" }),
    produto({ productId: 2, productName: "MANTA", class: "A", revenueClass: "A", profitClass: "C" }),
    produto({
      productId: 3,
      productName: "CANECA",
      class: "B",
      revenueClass: "B",
      profitClass: "A",
      supplierName: "Master",
    }),
    produto({ productId: 4, productName: "PANO", class: "C", revenueClass: "C", profitClass: "C" }),
  ],
};

describe("useProductAbc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetProductAbc.mockReturnValue({
      data: RELATORIO,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("abre em 90 dias por faturamento e pede o recorte ao servidor", async () => {
    const { result } = renderHook(() => useProductAbc(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    // Noventa dias, e não os trinta do desempenho de fornecedores: numa loja de
    // variedades a maior parte do catálogo vende poucas vezes por trimestre.
    expect(result.current.period.label).toBe("Últimos 90 dias");
    expect(mocks.useGetProductAbc).toHaveBeenCalledWith(
      expect.objectContaining({ criterion: ABC_CRITERION.Revenue }),
    );
  });

  it("o critério vai ao servidor, e não à lista já classificada", async () => {
    const { result } = renderHook(() => useProductAbc(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.setCriterion(ABC_CRITERION.Profit));

    // Trocar o critério RECLASSIFICA todo mundo; reordenar no cliente deixaria a
    // classe A da tela sendo a classe A de outro recorte.
    await waitFor(() =>
      expect(mocks.useGetProductAbc).toHaveBeenCalledWith(
        expect.objectContaining({ criterion: ABC_CRITERION.Profit }),
      ),
    );
  });

  it("a célula da matriz recorta a lista, e clicar de novo desfaz", async () => {
    const { result } = renderHook(() => useProductAbc(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.toggleFocus({ tipo: "celula", receita: "A", lucro: "C" }));
    expect(result.current.products.map((x) => x.productId)).toEqual([2]);

    act(() => result.current.toggleFocus({ tipo: "celula", receita: "A", lucro: "C" }));
    expect(result.current.products).toHaveLength(4);
  });

  it("o achado recorta pelos ids que o servidor mandou", async () => {
    const { result } = renderHook(() => useProductAbc(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.toggleFocus({ tipo: "achado", chave: "hiddenGems", ids: [3] }));

    expect(result.current.products.map((x) => x.productName)).toEqual(["CANECA"]);
  });

  it("a busca soma ao recorte em vez de substituí-lo", async () => {
    const { result } = renderHook(() => useProductAbc(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    act(() => result.current.toggleFocus({ tipo: "classe", classe: "A" }));
    act(() => result.current.setSearch("manta"));

    expect(result.current.products.map((x) => x.productId)).toEqual([2]);

    // A busca também alcança fornecedor, que é como se procura "o que veio da
    // Master" sem sair da tela.
    act(() => result.current.clearFocus());
    act(() => result.current.setSearch("master"));
    expect(result.current.products.map((x) => x.productName)).toEqual(["CANECA"]);
  });

  it("o começo da cauda sai da própria curva, e não de outro campo", async () => {
    const { result } = renderHook(() => useProductAbc(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.report).toBeDefined());

    // Primeiro ponto em que o acumulado passa de 95%.
    expect(result.current.tailStartsAt).toBe(75);
  });
});
