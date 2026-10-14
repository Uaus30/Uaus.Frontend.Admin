import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LowStockItemDto, SupplierDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetLowStock: vi.fn(),
  getLowStockPage: vi.fn(),
  useAllSuppliers: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  exportLowStockToXlsx: vi.fn(),
}));

// Só o que fala com a rede é dublado; o resto do api-client é o de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLowStock: mocks.useGetLowStock,
  getLowStockPage: mocks.getLowStockPage,
}));

vi.mock("@/hooks/use-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-catalog")>()),
  useAllSuppliers: mocks.useAllSuppliers,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/relatorios/lista-de-compras", mocks.navigate],
}));

vi.mock("../../lib/export-low-stock", () => ({
  exportLowStockToXlsx: mocks.exportLowStockToXlsx,
}));

const { useShoppingList, ALL_OPTION, SHOPPING_LIST_PAGE_SIZE } = await import("../useShoppingList");

/** Fornecedor com o mínimo que o seletor lê: id, nome e cidade. */
function fornecedor(id: number, name: string, city: string): SupplierDto {
  return { id, name, city } as SupplierDto;
}

const master = fornecedor(4, "Master", "Maringá");
const nossaCasa = fornecedor(7, "Nossa Casa", "Maringa");
const atacadao = fornecedor(9, "Atacadão", "Umuarama");

/** Fora do controle por compra pequena de atacado, sem compra em aberto. */
const balde: LowStockItemDto = {
  productId: 30,
  productGroupId: 3,
  productName: "BALDE 5L [PRETO]",
  barcode: "789000000030",
  categoryName: "Utilidades",
  supplierName: "Master",
  supplierId: 4,
  supplierCity: "Maringá",
  stock: 0,
  minStock: 0,
  effectiveMinStock: 2,
  stockControlEnabled: false,
  stockControlDisabledReason: "PlanTrip",
  price: 20,
  costPrice: 9,
  recentSales: 6,
  dailyDemand: 0.2,
  averageDailySales: 0.2,
  lastPurchaseQuantity: 3,
  lastPurchaseDate: "2026-09-25T00:00:00",
  hasOpenPurchase: false,
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Parâmetros da última consulta da lista. */
function lastListParams() {
  return mocks.useGetLowStock.mock.calls.at(-1)?.[0];
}

describe("useShoppingList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetLowStock.mockReturnValue({
      data: { data: [balde], page: 1, limit: SHOPPING_LIST_PAGE_SIZE, total: 1, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mocks.useAllSuppliers.mockReturnValue({ data: [master, nossaCasa, atacadao] });
    mocks.getLowStockPage.mockResolvedValue({ data: [balde], page: 1, limit: 1000, total: 1, totalPages: 1 });
    mocks.exportLowStockToXlsx.mockResolvedValue(undefined);
  });

  it("consulta a lista de compras sem filtro, na primeira página", () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    expect(lastListParams()).toEqual({
      scope: "ShoppingList",
      search: undefined,
      minRecentSales: undefined,
      supplierId: undefined,
      city: undefined,
      // Falso é o padrão do backend: não vai na requisição.
      includePurchasesInTransit: undefined,
      page: 1,
      limit: SHOPPING_LIST_PAGE_SIZE,
    });
    expect(result.current.supplierId).toBe(ALL_OPTION);
    expect(result.current.city).toBe(ALL_OPTION);
    expect(result.current.items).toEqual([balde]);
    expect(result.current.total).toBe(1);
  });

  it("as cidades saem dos fornecedores, uma vez cada — Maringá e Maringa são a mesma viagem", () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    expect(result.current.cityOptions.map((option) => option.label)).toEqual(["Maringá", "Umuarama"]);
  });

  it("filtrar pela cidade manda o NOME mostrado, e volta à primeira página", () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });
    const maringa = result.current.cityOptions.find((option) => option.label === "Maringá");

    act(() => result.current.setPage(3));
    act(() => result.current.setCity(maringa!.value));

    expect(result.current.page).toBe(1);
    // O backend compara sem acento e sem caixa; mandar a chave interna
    // ("maringa") funcionaria por acaso e quebraria no primeiro ajuste dela.
    expect(lastListParams()).toMatchObject({ city: "Maringá", page: 1 });
  });

  it("filtrar pelo fornecedor manda o id como número", () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setSupplierId("4"));

    expect(result.current.page).toBe(1);
    expect(lastListParams()).toMatchObject({ supplierId: 4 });

    act(() => result.current.setSupplierId(ALL_OPTION));
    expect(lastListParams()).toMatchObject({ supplierId: undefined });
  });

  it("o mínimo de vendas só vai quando é inteiro positivo", async () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    act(() => result.current.setMinRecentSales("3"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: 3 }));

    act(() => result.current.setMinRecentSales("0"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: undefined }));
  });

  it("a caixa da compra a caminho vai marcada e volta à primeira página", () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setIncludePurchasesInTransit(true));

    expect(result.current.page).toBe(1);
    expect(lastListParams()).toMatchObject({ includePurchasesInTransit: true });
  });

  it("Comprar leva ao pedido de compra com o produto e o último fornecedor, como no relatório", () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    act(() => result.current.comprar(balde));

    expect(mocks.navigate).toHaveBeenCalledWith("/estoque/compras?produto=30&fornecedor=4");
  });

  it("exporta a lista inteira com os filtros da tela, num arquivo próprio", async () => {
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });
    const maringa = result.current.cityOptions.find((option) => option.label === "Maringá");

    act(() => result.current.setCity(maringa!.value));
    act(() => result.current.setIncludePurchasesInTransit(true));
    await act(async () => {
      result.current.exportToXlsx();
    });

    await waitFor(() =>
      expect(mocks.getLowStockPage).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "ShoppingList",
          city: "Maringá",
          includePurchasesInTransit: true,
          page: 1,
          limit: 1000,
        }),
      ),
    );
    await waitFor(() =>
      expect(mocks.exportLowStockToXlsx).toHaveBeenCalledWith(
        [balde],
        expect.stringMatching(/^lista-de-compras-\d{4}-\d{2}-\d{2}\.xlsx$/),
        "Lista de Compras",
      ),
    );
  });

  it("sem fornecedores carregados, a tela abre sem cidades em vez de quebrar", () => {
    mocks.useAllSuppliers.mockReturnValue({ data: undefined });
    const { result } = renderHook(() => useShoppingList(), { wrapper: createWrapper() });

    expect(result.current.cityOptions).toEqual([]);
    expect(result.current.supplierOptions).toEqual([]);
  });
});
