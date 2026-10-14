import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LowStockItemDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetLowStock: vi.fn(),
  disableStockControl: vi.fn(),
  enableStockControl: vi.fn(),
  inactivateProduct: vi.fn(),
  getLowStockPage: vi.fn(),
  useGetLowStockSummary: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  exportLowStockToXlsx: vi.fn(),
}));

// Só o que fala com a rede é dublado; as chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLowStock: mocks.useGetLowStock,
  disableStockControl: mocks.disableStockControl,
  enableStockControl: mocks.enableStockControl,
  inactivateProduct: mocks.inactivateProduct,
  getLowStockPage: mocks.getLowStockPage,
  useGetLowStockSummary: mocks.useGetLowStockSummary,
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
  effectiveMinStock: 5,
  stockControlEnabled: true,
  price: 10,
  costPrice: 4,
  lastSaleAt: "2026-09-05T10:00:00",
  recentSales: 12,
  dailyDemand: 0.1333,
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

describe("useLowStock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    givenList([bexiga]);
    mocks.disableStockControl.mockResolvedValue({ ...bexiga, stockControlEnabled: false });
    mocks.enableStockControl.mockResolvedValue(bexiga);
    mocks.inactivateProduct.mockResolvedValue(bexiga);
    mocks.getLowStockPage.mockResolvedValue({
      data: [bexiga],
      page: 1,
      limit: 1000,
      total: 1,
      totalPages: 1,
    });
    mocks.useGetLowStockSummary.mockReturnValue({ data: { restock: 7, withPurchaseInTransit: 3 } });
    mocks.exportLowStockToXlsx.mockResolvedValue(undefined);
  });

  it("abre sem filtro nenhum, na primeira página e na ordem padrão", () => {
    // Os campos chegaram semeados com os números do alerta por uma semana,
    // porque sem filtro a tela caía no relatório clássico — três produtos de
    // mil. Agora o critério do backend responde sozinho, e semear filtro
    // esconderia o que ele passou a alcançar: o produto sem mínimo que acaba em
    // duas semanas.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(lastListParams()).toMatchObject({
      maxStock: undefined,
      minRecentSales: undefined,
      // `Default` não vai na requisição: é o que o backend já faz sem o
      // parâmetro, e mandá-lo criaria uma chave de cache diferente para a mesma
      // consulta.
      sort: undefined,
      // `Restock` também não vai: é a lista padrão do backend.
      scope: undefined,
      page: 1,
      limit: PAGE_SIZE,
    });
    expect(result.current.scope).toBe("Restock");
    expect(result.current.maxStock).toBe("");
    expect(result.current.minRecentSales).toBe("");
    expect(result.current.sort).toBe("Default");
    expect(result.current.items).toEqual([bexiga]);
  });

  it("a lista é consultada na primeira renderização, sem esperar contagem nenhuma", () => {
    // A espera existia para o filtro semeado chegar junto. Sem semeadura, a
    // tela que espera é tela em branco de graça.
    renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(mocks.useGetLowStock.mock.calls.at(-1)?.[1]?.query?.enabled).toBeUndefined();
  });

  it("apagar o filtro devolve o relatório inteiro", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMaxStock("5"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ maxStock: 5 }));

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

    act(() => result.current.setPage(2));
    act(() => result.current.setScope("OutOfControl"));
    expect(result.current.page).toBe(1);
  });

  it("a aba Fora do controle consulta a outra lista", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setScope("OutOfControl"));

    expect(result.current.scope).toBe("OutOfControl");
    expect(lastListParams()).toMatchObject({ scope: "OutOfControl" });
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

  it("desligar o controle de estoque pergunta antes, leva o motivo e chama a API", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askDisableStockControl(bexiga));
    expect(result.current.confirm).toEqual({ item: bexiga, action: "disable-control", reason: null });
    expect(mocks.disableStockControl).not.toHaveBeenCalled();

    act(() => result.current.setConfirmReason("EndOfLine"));
    await act(async () => {
      result.current.confirmAction();
    });

    await waitFor(() => expect(mocks.disableStockControl).toHaveBeenCalledWith(10, "EndOfLine"));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Controle de estoque desligado" }),
      ),
    );
    expect(mocks.inactivateProduct).not.toHaveBeenCalled();
  });

  it("religar não pergunta: grava na hora", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.enableStockControl(bexiga);
    });

    await waitFor(() => expect(mocks.enableStockControl).toHaveBeenCalledWith(10));
    expect(result.current.confirm).toBeNull();
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Controle de estoque religado" }),
      ),
    );
    expect(mocks.disableStockControl).not.toHaveBeenCalled();
  });

  it("inativar pergunta antes e chama o OUTRO endpoint", async () => {
    // As duas ações do menu passam pelo mesmo diálogo e pela mesma mutação; a
    // que decide o que gravar é a ação guardada na confirmação. Trocá-las aqui
    // não daria erro de compilação — daria produto inativado sem querer.
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askInactivate(bexiga));
    expect(result.current.confirm).toEqual({ item: bexiga, action: "inactivate" });
    expect(mocks.inactivateProduct).not.toHaveBeenCalled();

    await act(async () => {
      result.current.confirmAction();
    });

    await waitFor(() => expect(mocks.inactivateProduct).toHaveBeenCalledWith(10));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Produto inativado" })),
    );
    expect(mocks.disableStockControl).not.toHaveBeenCalled();
  });

  it("cancelar a confirmação não chama nada", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askInactivate(bexiga));
    act(() => result.current.cancelConfirm());

    expect(result.current.confirm).toBeNull();
    expect(mocks.disableStockControl).not.toHaveBeenCalled();
    expect(mocks.inactivateProduct).not.toHaveBeenCalled();
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
      expect(mocks.getLowStockPage).toHaveBeenCalledWith(
        expect.objectContaining({
          maxStock: 5,
          minRecentSales: 3,
          sort: "RecentSalesDesc",
          page: 1,
          limit: 1000,
        }),
      ),
    );
    await waitFor(() => expect(mocks.exportLowStockToXlsx).toHaveBeenCalled());
  });

  it("avisa quando não há nada para exportar", async () => {
    mocks.getLowStockPage.mockResolvedValueOnce({ data: [], page: 1, limit: 1000, total: 0, totalPages: 1 });
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

  it("avisa em vermelho quando a API recusa, citando a ação que falhou", async () => {
    mocks.disableStockControl.mockRejectedValueOnce(new Error("Produto não encontrado!"));
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.askDisableStockControl(bexiga));
    await act(async () => {
      result.current.confirmAction();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Erro ao desligar o controle de estoque", variant: "destructive" }),
      ),
    );
  });
});

describe("useLowStock — compra a caminho (14/10/2026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    givenList([bexiga]);
    mocks.getLowStockPage.mockResolvedValue({
      data: [bexiga],
      page: 1,
      limit: 1000,
      total: 1,
      totalPages: 1,
    });
    mocks.exportLowStockToXlsx.mockResolvedValue(undefined);
    mocks.useGetLowStockSummary.mockReturnValue({ data: { restock: 7, withPurchaseInTransit: 3 } });
  });

  it("abre sem os com compra a caminho, e diz quantos ficaram de fora", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(result.current.includePurchasesInTransit).toBe(false);
    // Falso é o padrão do backend: não vai na requisição.
    expect(lastListParams()).toMatchObject({ includePurchasesInTransit: undefined });
    expect(result.current.withPurchaseInTransit).toBe(3);
  });

  it("com filtro na tela não diz quantos ficaram de fora — o número do alerta é sem filtro", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setMinRecentSales("10"));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: 10 }));

    expect(result.current.withPurchaseInTransit).toBe(0);

    act(() => result.current.setMinRecentSales(""));
    await waitFor(() => expect(lastListParams()).toMatchObject({ minRecentSales: undefined }));

    expect(result.current.withPurchaseInTransit).toBe(3);
  });

  it("um backend sem o campo novo conta zero de fora, em vez de quebrar", () => {
    mocks.useGetLowStockSummary.mockReturnValue({ data: { restock: 7 } });
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    expect(result.current.withPurchaseInTransit).toBe(0);
  });

  it("marcar a caixa pede a lista com eles e volta à primeira página", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setIncludePurchasesInTransit(true));

    expect(result.current.page).toBe(1);
    expect(lastListParams()).toMatchObject({ includePurchasesInTransit: true, page: 1 });
  });

  it("na aba Fora do controle a caixa não vale — a consulta não leva o parâmetro", () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setIncludePurchasesInTransit(true));
    act(() => result.current.setScope("OutOfControl"));

    expect(lastListParams()).toMatchObject({ scope: "OutOfControl", includePurchasesInTransit: undefined });
  });

  it("a exportação respeita a caixa", async () => {
    const { result } = renderHook(() => useLowStock(), { wrapper: createWrapper() });

    act(() => result.current.setIncludePurchasesInTransit(true));
    await act(async () => {
      result.current.exportToXlsx();
    });

    await waitFor(() =>
      expect(mocks.getLowStockPage).toHaveBeenCalledWith(
        expect.objectContaining({ includePurchasesInTransit: true, limit: 1000 }),
      ),
    );
    await waitFor(() =>
      expect(mocks.exportLowStockToXlsx).toHaveBeenCalledWith(
        [bexiga],
        expect.stringMatching(/^estoque-baixo-\d{4}-\d{2}-\d{2}\.xlsx$/),
        undefined,
      ),
    );
  });
});
