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
  disableStockControl: vi.fn(),
  apiGetOrThrow: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  exportLowStockToXlsx: vi.fn(),
}));

// Só o que fala com a rede é dublado; as chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLowStock: mocks.useGetLowStock,
  useGetLowStockSummary: mocks.useGetLowStockSummary,
  resolveLowStock: mocks.resolveLowStock,
  reopenLowStock: mocks.reopenLowStock,
  disableStockControl: mocks.disableStockControl,
  apiGetOrThrow: mocks.apiGetOrThrow,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/relatorios/estoque-baixo", mocks.navigate],
}));

vi.mock("../../lib/export-low-stock", () => ({
  exportLowStockToXlsx: mocks.exportLowStockToXlsx,
}));

const { useLowStock, PAGE_SIZE } = await import("../useLowStock");

/** Pendente, sem compra em aberto: o "Resolver" leva ao pedido de compra. */
const bexiga: LowStockItemDto = {
  productId: 10,
  productGroupId: 1,
  productName: "BEXIGA [AZUL]",
  barcode: "789000000010",
  categoryName: "Balões",
  supplierName: "Shopee",
  supplierId: 13,
  imageUrl: null,
  stock: 3,
  minStock: 5,
  price: 10,
  costPrice: 4,
  lastSaleAt: "2026-09-05T10:00:00",
  averageDailySales: 0.13,
  daysOfCover: 23.1,
  hasOpenPurchase: false,
  resolvedAt: null,
  resolvedBy: null,
  isResolved: false,
};

/** Mesmo produto, já com compra encaminhada: aí o botão pergunta e resolve. */
const bexigaComCompra: LowStockItemDto = { ...bexiga, hasOpenPurchase: true };

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

function givenList(items: LowStockItemDto[]) {
  mocks.useGetLowStock.mockReturnValue({
    data: { data: items, page: 1, limit: PAGE_SIZE, total: items.length, totalPages: 1 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  });
}

describe("useLowStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    givenList([bexiga]);
    mocks.useGetLowStockSummary.mockReturnValue({ data: { pending: 1, resolved: 0 } });
    mocks.resolveLowStock.mockResolvedValue({
      ...bexiga,
      isResolved: true,
      resolvedAt: "2026-09-06T10:00:00",
    });
    mocks.reopenLowStock.mockResolvedValue(bexiga);
    mocks.disableStockControl.mockResolvedValue({ ...bexiga, minStock: 0 });
    mocks.apiGetOrThrow.mockResolvedValue({ items: [bexiga] });
    mocks.exportLowStockToXlsx.mockResolvedValue(undefined);
  });

  it("começa só com os pendentes, na primeira página e sem teto de saldo", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(lastListParams()).toMatchObject({
      includeResolved: false,
      maxStock: undefined,
      page: 1,
      limit: PAGE_SIZE,
    });
    expect(result.current.items).toEqual([bexiga]);
    expect(result.current.summary).toEqual({ pending: 1, resolved: 0 });
  });

  it("manda o teto de saldo só quando é inteiro positivo", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMaxStock("5"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: 5 }));

    // Zero e lixo digitado voltam ao padrão: "menos de zero unidades" não é
    // pergunta, e o relatório não pode ficar vazio por um dígito errado.
    act(() => result.current.setMaxStock("0"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: undefined }));

    act(() => result.current.setMaxStock("abc"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: undefined }));
  });

  it("mostrar resolvidos, buscar e filtrar voltam para a primeira página", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    act(() => result.current.setIncludeResolved(true));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    act(() => result.current.setSearch("bexiga"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    act(() => result.current.setMaxStock("5"));
    expect(result.current.page).toBe(1);
  });

  it("sem compra em aberto, Resolver leva ao pedido de compra e NÃO marca nada", async () => {
    // A regra do fluxo: resolver o alerta é encaminhar a reposição. Marcar aqui
    // esconderia o vermelho sem ninguém ter comprado nada.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.resolve(bexiga));

    expect(mocks.resolveLowStock).not.toHaveBeenCalled();
    expect(result.current.confirm).toBeNull();
    expect(mocks.navigate).toHaveBeenCalledWith("/estoque/compras?produto=10&fornecedor=13");
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Registre o pedido de compra", variant: "warning" }),
    );
  });

  it("com compra em aberto, Resolver pergunta antes e só então marca", async () => {
    givenList([bexigaComCompra]);
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.resolve(bexigaComCompra));

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.confirm).toEqual({ kind: "resolve", item: bexigaComCompra });
    expect(mocks.resolveLowStock).not.toHaveBeenCalled();

    await act(async () => {
      result.current.confirmAction();
    });

    await waitFor(() => expect(mocks.resolveLowStock).toHaveBeenCalledWith(10));
    await waitFor(() => expect(result.current.confirm).toBeNull());
  });

  it("remover o controle de estoque pergunta antes e chama a API", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askDisableStockControl(bexiga));
    expect(result.current.confirm).toEqual({ kind: "disable-control", item: bexiga });
    expect(mocks.disableStockControl).not.toHaveBeenCalled();

    await act(async () => {
      result.current.confirmAction();
    });

    await waitFor(() => expect(mocks.disableStockControl).toHaveBeenCalledWith(10));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Controle de estoque removido" }),
      ),
    );
  });

  it("cancelar a confirmação não chama nada", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askDisableStockControl(bexiga));
    act(() => result.current.cancelConfirm());

    expect(result.current.confirm).toBeNull();
    expect(mocks.disableStockControl).not.toHaveBeenCalled();
  });

  it("reabre o alerta pela API", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.reopen(10);
    });

    await waitFor(() => expect(mocks.reopenLowStock).toHaveBeenCalledWith(10));
  });

  it("exporta o relatório INTEIRO com os filtros da tela, não a página em memória", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMaxStock("5"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: 5 }));

    await act(async () => {
      result.current.exportToXlsx();
    });

    await waitFor(() =>
      expect(mocks.apiGetOrThrow).toHaveBeenCalledWith(
        "/LowStock",
        expect.objectContaining({ maxStock: 5, page: 1, size: 1000 }),
      ),
    );
    await waitFor(() => expect(mocks.exportLowStockToXlsx).toHaveBeenCalled());
  });

  it("avisa quando não há nada para exportar", async () => {
    mocks.apiGetOrThrow.mockResolvedValueOnce({ items: [] });
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.exportToXlsx();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Nada para exportar", variant: "warning" }),
      ),
    );
    expect(mocks.exportLowStockToXlsx).not.toHaveBeenCalled();
  });

  it("avisa em vermelho quando a API recusa", async () => {
    mocks.disableStockControl.mockRejectedValueOnce(new Error("Produto não encontrado!"));
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askDisableStockControl(bexiga));
    await act(async () => {
      result.current.confirmAction();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Erro ao remover o controle de estoque", variant: "destructive" }),
      ),
    );
  });
});
