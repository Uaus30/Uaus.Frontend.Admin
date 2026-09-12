import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryCountDto, InventoryCountItemDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetCurrentInventoryCount: vi.fn(),
  useGetInventoryCountItems: vi.fn(),
  startInventoryCount: vi.fn(),
  finishInventoryCount: vi.fn(),
  reviewInventoryCountProduct: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  useAllCategories: vi.fn(),
}));

// Só o que fala com a rede é dublado; chaves de cache e enums vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCurrentInventoryCount: mocks.useGetCurrentInventoryCount,
  useGetInventoryCountItems: mocks.useGetInventoryCountItems,
  startInventoryCount: mocks.startInventoryCount,
  finishInventoryCount: mocks.finishInventoryCount,
  reviewInventoryCountProduct: mocks.reviewInventoryCountProduct,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/estoque/inventario", mocks.navigate],
}));

vi.mock("@/hooks/use-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-catalog")>()),
  useAllCategories: mocks.useAllCategories,
}));

const { useInventoryCount } = await import("../useInventoryCount");

const conferenciaAberta: InventoryCountDto = {
  id: 7,
  status: "Open",
  statusName: "Em andamento",
  startedAt: "2026-09-12T09:00:00",
  finishedAt: null,
  userId: 3,
  userName: "Ana",
  notes: null,
  totalItems: 884,
  reviewedItems: 883,
  pendingItems: 1,
};

const bacia: InventoryCountItemDto = {
  id: 100,
  productGroupId: 12,
  productGroupName: "BACIA PLASTICA",
  categoryName: "Utilidades",
  variationsCount: 3,
  hasImage: true,
  imageUrl: null,
  stock: 8,
  stockAtSnapshot: 10,
  price: 12,
  reviewed: false,
  reviewedAt: null,
  reviewedByUserName: null,
  stockAtReview: null,
  notes: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Parâmetros da última consulta da lista — é por eles que o filtro se prova. */
function lastListParams() {
  const calls = mocks.useGetInventoryCountItems.mock.calls;
  return calls[calls.length - 1]?.[1];
}

function givenConferencia(count: InventoryCountDto | null) {
  mocks.useGetCurrentInventoryCount.mockReturnValue({
    data: count,
    isLoading: false,
    isError: false,
    error: null,
  });
}

function givenItens(items: InventoryCountItemDto[]) {
  mocks.useGetInventoryCountItems.mockReturnValue({
    data: { data: items, page: 1, limit: 20, total: items.length, totalPages: 1 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  });
}

describe("useInventoryCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAllCategories.mockReturnValue({ data: [] });
    givenConferencia(conferenciaAberta);
    givenItens([bacia]);
  });

  it("abre a lista pelos PENDENTES — é o que faz a conferência terminar", () => {
    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });

    expect(result.current.statusFilter).toBe("pending");
    expect(lastListParams()).toMatchObject({ status: "pending", page: 1 });
  });

  it("sem conferência aberta, não consulta a lista", () => {
    givenConferencia(null);

    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });

    expect(result.current.count).toBeNull();
    // O id vai como `undefined`: é ele que desliga a query no api-client.
    expect(mocks.useGetInventoryCountItems.mock.calls.at(-1)?.[0]).toBeUndefined();
  });

  it("trocar o filtro volta para a primeira página", async () => {
    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });

    act(() => result.current.setPage(5));
    await waitFor(() => expect(lastListParams()).toMatchObject({ page: 5 }));

    act(() => result.current.setStatusFilter("all"));

    await waitFor(() => expect(lastListParams()).toMatchObject({ status: "all", page: 1 }));
  });

  it("avisa quantos faltam ao marcar um produto", async () => {
    mocks.reviewInventoryCountProduct.mockResolvedValue({
      ...conferenciaAberta,
      reviewedItems: 500,
      pendingItems: 384,
    });

    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });
    act(() => result.current.review(12, true));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.reviewInventoryCountProduct).toHaveBeenCalledWith(12, true);
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({
      title: "Produto conferido",
      description: expect.stringContaining("384"),
    });
  });

  it("anuncia o ENCERRAMENTO quando o último item é conferido", async () => {
    // O encerramento chega na RESPOSTA da marcação, não numa consulta nova:
    // perguntar de novo abriria uma janela em que a tela mostra "0 pendentes"
    // com a conferência ainda aberta.
    mocks.reviewInventoryCountProduct.mockResolvedValue({
      ...conferenciaAberta,
      status: "Finished",
      statusName: "Encerrada",
      finishedAt: "2026-09-12T18:00:00",
      reviewedItems: 884,
      pendingItems: 0,
    });

    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });
    act(() => result.current.review(12, true));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({ title: "Conferência concluída!" });
  });

  it("desmarcar devolve o item aos pendentes, sem falar em encerramento", async () => {
    mocks.reviewInventoryCountProduct.mockResolvedValue({
      ...conferenciaAberta,
      reviewedItems: 882,
      pendingItems: 2,
    });

    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });
    act(() => result.current.review(12, false));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.reviewInventoryCountProduct).toHaveBeenCalledWith(12, false);
    expect(mocks.toast.mock.calls[0][0]).toMatchObject({ title: "Produto devolvido à lista" });
  });

  it("abre o produto carimbando que veio da conferência", () => {
    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });

    act(() => result.current.openProduct(12));

    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/produtos/12/detalhes"));
    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("conferencia=1"));
  });

  it("o encerramento manual passa pela confirmação", async () => {
    mocks.finishInventoryCount.mockResolvedValue({
      ...conferenciaAberta,
      status: "Finished",
      pendingItems: 1,
    });

    const { result } = renderHook(() => useInventoryCount(), { wrapper: createWrapper() });

    expect(result.current.finishAsked).toBe(false);
    act(() => result.current.askFinish());
    expect(result.current.finishAsked).toBe(true);
    expect(mocks.finishInventoryCount).not.toHaveBeenCalled();

    act(() => result.current.confirmFinish());

    await waitFor(() => expect(mocks.finishInventoryCount).toHaveBeenCalledWith(7));
  });
});
