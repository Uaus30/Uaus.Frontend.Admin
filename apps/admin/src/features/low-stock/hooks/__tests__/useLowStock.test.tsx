import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LowStockItemDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetLowStock: vi.fn(),
  useGetLowStockSummary: vi.fn(),
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

/** Sem compra em aberto: a linha mostra o botao "Comprar". */
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
  recentSales: 12,
  averageDailySales: 0.13,
  daysOfCover: 23.1,
  hasOpenPurchase: false,
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

function givenList(items: LowStockItemDto[]) {
  mocks.useGetLowStock.mockReturnValue({
    data: { data: items, page: 1, limit: PAGE_SIZE, total: items.length, totalPages: 1 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  });
}

/** A contagem do alerta, que é de onde saem os filtros padrão da tela. */
const resumoDoAlerta = { restock: 1, restockMinSales: 3, restockMaxStock: 5 };

describe("useLowStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sem `?vendas=` na URL: é o caminho de quem chega pelo menu.
    window.history.replaceState({}, "", "/relatorios/estoque-baixo");
    givenList([bexiga]);
    mocks.useGetLowStockSummary.mockReturnValue({ data: resumoDoAlerta, isError: false });
    mocks.disableStockControl.mockResolvedValue({ ...bexiga, minStock: 0 });
    mocks.apiGetOrThrow.mockResolvedValue({ items: [bexiga] });
    mocks.exportLowStockToXlsx.mockResolvedValue(undefined);
  });

  it("abre com os filtros do alerta, na primeira página e sem ordem", () => {
    // Sem padrão, a tela caía no relatório clássico — só quem tem estoque
    // mínimo configurado —, que na loja são três produtos de mil.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(lastListParams()).toMatchObject({
      maxStock: 5,
      minRecentSales: 3,
      // `Default` não vai na requisição: é o que o backend já faz sem o
      // parâmetro, e mandá-lo criaria uma chave de cache diferente para a mesma
      // consulta.
      sort: undefined,
      page: 1,
      limit: PAGE_SIZE,
    });
    expect(result.current.maxStock).toBe("5");
    expect(result.current.minRecentSales).toBe("3");
    expect(result.current.sort).toBe("Default");
    expect(result.current.items).toEqual([bexiga]);
    expect(result.current.summary).toEqual(resumoDoAlerta);
  });

  it("os números do padrão vêm do backend, não de constantes da tela", () => {
    mocks.useGetLowStockSummary.mockReturnValue({
      data: { restock: 4, restockMinSales: 10, restockMaxStock: 2 },
      isError: false,
    });

    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(result.current.maxStock).toBe("2");
    expect(result.current.minRecentSales).toBe("10");
  });

  it("a lista só é consultada depois que os padrões chegam", () => {
    // Sem a espera, a primeira carga iria sem filtro e a tela trocaria a lista
    // inteira um instante depois.
    mocks.useGetLowStockSummary.mockReturnValue({ data: undefined, isError: false });

    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(lastListParams()).toMatchObject({ maxStock: undefined, minRecentSales: undefined });
    expect(mocks.useGetLowStock.mock.calls.at(-1)?.[1]).toMatchObject({ query: { enabled: false } });
    expect(result.current.isLoading).toBe(true);
  });

  it("se a contagem falhar, a tela abre sem padrão em vez de ficar em branco", () => {
    mocks.useGetLowStockSummary.mockReturnValue({ data: undefined, isError: true });

    renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(mocks.useGetLowStock.mock.calls.at(-1)?.[1]).toMatchObject({ query: { enabled: true } });
  });

  it("vindo do alerta, o teto de saldo fica vazio para a lista bater com a contagem", () => {
    // O backend, recebendo só o filtro de saída, aplica a definição do alerta de
    // "está acabando" — abaixo do PRÓPRIO mínimo de quem tem um. Preencher o
    // teto trocaria isso por um número fixo e esconderia o produto de mínimo 20
    // com saldo 8, que o alerta acabou de contar.
    window.history.replaceState({}, "", "/relatorios/estoque-baixo?vendas=7");

    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(result.current.minRecentSales).toBe("7");
    expect(result.current.maxStock).toBe("");
    expect(lastListParams()).toMatchObject({ maxStock: undefined, minRecentSales: 7 });
  });

  it("campo esvaziado pelo usuário não volta ao padrão", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMaxStock(""));

    expect(result.current.maxStock).toBe("");
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: undefined }));
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

  it("manda o mínimo de vendas só quando é inteiro positivo", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMinRecentSales("3"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: 3 }));

    // Campo apagado, zero e lixo digitado voltam ao padrão: "vendeu ao menos
    // zero" traria o catálogo inteiro para um relatório de estoque baixo.
    act(() => result.current.setMinRecentSales("0"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: undefined }));

    act(() => result.current.setMinRecentSales(""));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: undefined }));
  });

  it("o cabeçalho de vendas cicla entre mais vendido, menos vendido e o padrão", () => {
    // O terceiro clique volta ao padrão porque a ordem padrão — o mais crítico
    // primeiro — é a razão de ser do relatório; sem ela, quem ordenasse por
    // venda uma vez a perderia até recarregar a tela.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.toggleSalesSort());
    expect(result.current.sort).toBe("RecentSalesDesc");
    expect(lastListParams()).toMatchObject({ sort: "RecentSalesDesc" });

    act(() => result.current.toggleSalesSort());
    expect(result.current.sort).toBe("RecentSalesAsc");

    act(() => result.current.toggleSalesSort());
    expect(result.current.sort).toBe("Default");
    expect(lastListParams()).toMatchObject({ sort: undefined });
  });

  it("buscar e filtrar voltam para a primeira página", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setSearch("bexiga"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    act(() => result.current.setMaxStock("5"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    act(() => result.current.setMinRecentSales("3"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    act(() => result.current.toggleSalesSort());
    expect(result.current.page).toBe(1);
  });

  it("Comprar leva ao pedido de compra, sem confirmação e sem aviso", async () => {
    // O botão se chama "Comprar" e a tela de destino é o formulário de compra;
    // um toast dizendo o que acabou de acontecer só pede para ser dispensado.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.comprar(bexiga));

    expect(mocks.navigate).toHaveBeenCalledWith("/estoque/compras?produto=10&fornecedor=13");
    expect(result.current.confirm).toBeNull();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("remover o controle de estoque pergunta antes e chama a API", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askDisableStockControl(bexiga));
    expect(result.current.confirm).toEqual({ item: bexiga });
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

  it("exporta o relatório INTEIRO com os filtros da tela, não a página em memória", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMaxStock("5"));
    act(() => result.current.setMinRecentSales("3"));
    act(() => result.current.toggleSalesSort());
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: 5, minRecentSales: 3 }));

    await act(async () => {
      result.current.exportToXlsx();
    });

    await waitFor(() =>
      expect(mocks.apiGetOrThrow).toHaveBeenCalledWith(
        "/LowStock",
        expect.objectContaining({
          maxStock: 5,
          minRecentSales: 3,
          sort: "RecentSalesDesc",
          page: 1,
          size: 1000,
        }),
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
