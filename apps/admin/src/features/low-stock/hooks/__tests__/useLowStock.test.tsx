import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LowStockItemDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetLowStock: vi.fn(),
  useGetLowStockSummary: vi.fn(),
  resolveLowStock: vi.fn(),
  reopenLowStock: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado; as chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLowStock: mocks.useGetLowStock,
  useGetLowStockSummary: mocks.useGetLowStockSummary,
  resolveLowStock: mocks.resolveLowStock,
  reopenLowStock: mocks.reopenLowStock,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useLowStock, PAGE_SIZE } = await import("../useLowStock");

const bexiga: LowStockItemDto = {
  productId: 10,
  productGroupId: 1,
  productName: "BEXIGA [AZUL]",
  barcode: "789000000010",
  categoryName: "Balões",
  supplierName: "Shopee",
  imageUrl: null,
  stock: 3,
  minStock: 5,
  price: 10,
  costPrice: 4,
  resolvedAt: null,
  resolvedBy: null,
  isResolved: false,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Parâmetros da última consulta da lista. */
function lastListParams() {
  const calls = mocks.useGetLowStock.mock.calls;
  return calls[calls.length - 1]?.[0];
}

describe("useLowStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetLowStock.mockReturnValue({
      data: { data: [bexiga], page: 1, limit: PAGE_SIZE, total: 1, totalPages: 1 },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    });
    mocks.useGetLowStockSummary.mockReturnValue({ data: { pending: 1, resolved: 0 } });
    mocks.resolveLowStock.mockResolvedValue({
      ...bexiga,
      isResolved: true,
      resolvedAt: "2026-09-05T10:00:00",
    });
    mocks.reopenLowStock.mockResolvedValue(bexiga);
  });

  it("começa só com os pendentes, na primeira página", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(lastListParams()).toMatchObject({ includeResolved: false, page: 1, limit: PAGE_SIZE });
    expect(result.current.items).toEqual([bexiga]);
    expect(result.current.summary).toEqual({ pending: 1, resolved: 0 });
  });

  it("mostrar resolvidos e buscar voltam para a primeira página", () => {
    // Manter a página 3 de um recorte maior mostraria "nenhum item" para um
    // relatório que tem itens.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setIncludeResolved(true));
    expect(result.current.page).toBe(1);
    expect(lastListParams()).toMatchObject({ includeResolved: true, page: 1 });

    act(() => result.current.setPage(2));
    act(() => result.current.setSearch("bexiga"));
    expect(result.current.page).toBe(1);
  });

  it("resolve o alerta pela API e avisa", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.resolve(10);
    });

    await waitFor(() => expect(mocks.resolveLowStock).toHaveBeenCalledWith(10));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Alerta resolvido" })),
    );
  });

  it("reabre o alerta pela API", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.reopen(10);
    });

    await waitFor(() => expect(mocks.reopenLowStock).toHaveBeenCalledWith(10));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Alerta reaberto" })),
    );
  });

  it("avisa em vermelho quando a API recusa", async () => {
    mocks.resolveLowStock.mockRejectedValueOnce(new Error("Produto não encontrado!"));
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.resolve(999);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Erro ao resolver o alerta", variant: "destructive" }),
      ),
    );
  });
});
