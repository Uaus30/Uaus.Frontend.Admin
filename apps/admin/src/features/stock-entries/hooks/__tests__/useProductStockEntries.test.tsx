import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetPurchaseEntriesQueryKey } from "@workspace/api-client-react";
import { RESOURCE_KEYS } from "@/hooks/use-catalog";

const mocks = vi.hoisted(() => ({
  receiveEntry: vi.fn(),
  useReceivePurchaseEntry: vi.fn(),
  deleteEntry: vi.fn(),
  useDeletePurchaseEntry: vi.fn(),
  useGetPurchaseEntries: vi.fn(),
  getProductById: vi.fn(),
}));

vi.mock("@/services/suppliers.service", () => ({
  getAllSuppliers: vi.fn(() => Promise.resolve([{ id: 10, name: "Supp 10" }])),
}));

vi.mock("@/services/products.service", () => ({
  getProductById: mocks.getProductById,
}));

// Dubla só o que fala com a rede; o resto do api-client — as chaves de cache
// inclusive — continua sendo o de verdade, senão o teste de invalidação
// validaria a chave inventada no mock em vez da que a tela usa.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchaseEntries: mocks.useGetPurchaseEntries,
  useGetPurchaseEntryDetails: vi.fn(() => ({ data: undefined, isLoading: false })),
  useReceivePurchaseEntry: mocks.useReceivePurchaseEntry,
  useDeletePurchaseEntry: mocks.useDeletePurchaseEntry,
}));

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const { useProductStockEntries } = await import("../useProductStockEntries");

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Object.assign(wrapper, { queryClient });
};

/** Parâmetros com que o hook consultou a listagem na última renderização. */
function lastListParams() {
  return mocks.useGetPurchaseEntries.mock.calls.at(-1)?.[0];
}

/** Opções da última chamada da listagem — é aí que mora o `enabled`. */
function lastListOptions() {
  return mocks.useGetPurchaseEntries.mock.calls.at(-1)?.[1];
}

function receiveOptions() {
  return mocks.useReceivePurchaseEntry.mock.calls.at(-1)?.[0];
}

function deleteOptions() {
  return mocks.useDeletePurchaseEntry.mock.calls.at(-1)?.[0];
}

function lastPayload() {
  return mocks.receiveEntry.mock.calls.at(-1)?.[0]?.data;
}

const submit = (result: { current: ReturnType<typeof useProductStockEntries> }) =>
  act(() => result.current.handleSaveEntry({ preventDefault: vi.fn() } as unknown as React.FormEvent));

describe("useProductStockEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useReceivePurchaseEntry.mockReturnValue({ mutate: mocks.receiveEntry, isPending: false });
    mocks.useDeletePurchaseEntry.mockReturnValue({ mutate: mocks.deleteEntry });
    mocks.useGetPurchaseEntries.mockReturnValue({
      data: { data: [], total: 0, totalPages: 1 },
      isLoading: false,
      isError: false,
      error: null,
    });
    mocks.getProductById.mockResolvedValue({
      id: 201,
      name: "COPO TÉRMICO",
      barcode: "7891",
      price: 39.9,
      costPrice: 18.4,
      stock: 7,
    });
  });

  it("consulta a listagem filtrada pelo produto", () => {
    renderHook(() => useProductStockEntries(201), { wrapper: createWrapper() });

    expect(lastListParams()).toMatchObject({ productId: 201, page: 1 });
    expect(lastListOptions().query.enabled).toBe(true);
  });

  it("não consulta nada enquanto o produto não foi salvo", () => {
    // Produto novo ainda não tem id. Consultar com `undefined` traria as
    // entradas de TODOS os produtos como se fossem deste.
    renderHook(() => useProductStockEntries(null), { wrapper: createWrapper() });

    expect(lastListParams().productId).toBeUndefined();
    expect(lastListOptions().query.enabled).toBe(false);
  });

  it("volta para a primeira página ao trocar de produto", async () => {
    // Trocar de variação mantendo a página 3 mostraria "nenhuma entrada" para
    // um produto que tem entradas.
    const { result, rerender } = renderHook(({ id }: { id: number }) => useProductStockEntries(id), {
      wrapper: createWrapper(),
      initialProps: { id: 201 },
    });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ id: 202 });

    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it("abre o lançamento já com o custo e o preço vigentes sugeridos", async () => {
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.product?.costPrice).toBe(18.4));
    act(() => result.current.openNewEntry());

    expect(result.current.newEntryModalOpen).toBe(true);
    expect(result.current.form).toMatchObject({ quantity: 1, unitCost: 18.4, price: 39.9 });
  });

  it("pré-seleciona o fornecedor da entrada mais recente ao abrir o lançamento", async () => {
    // O caso comum é repor com quem já vendeu — a listagem vem ordenada da mais
    // nova para a mais velha, então o primeiro item é o último fornecedor.
    mocks.useGetPurchaseEntries.mockReturnValue({
      data: {
        data: [
          { id: 9, entryDate: "2026-08-20T00:00:00", supplierId: 44, invoiceNumber: null, total: 10 },
          { id: 8, entryDate: "2026-08-01T00:00:00", supplierId: 10, invoiceNumber: null, total: 20 },
        ],
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.product?.costPrice).toBe(18.4));
    act(() => result.current.openNewEntry());

    expect(result.current.form.supplierId).toBe("44");
  });

  it("recusa preço de venda zero — ele passa a valer no cadastro do produto", () => {
    // Regressão: o backend grava o `price` do item como preço de venda do
    // produto; zero aqui zerava o preço da loja em silêncio.
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper: createWrapper() });

    act(() => {
      result.current.updateForm("supplierId", "10");
      result.current.updateForm("quantity", 2);
      result.current.updateForm("unitCost", 18.4);
      result.current.updateForm("price", 0);
    });
    submit(result);

    expect(mocks.receiveEntry).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("envia a data como instante LOCAL, com o produto da aba como único item", () => {
    // Regressão do 500 ao salvar: `entry_date` é `timestamp without time zone` e
    // o Npgsql recusa um DateTime com Kind=Utc, que é o que o toISOString gera.
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper: createWrapper() });

    act(() => {
      result.current.updateForm("supplierId", "10");
      result.current.updateForm("entryDate", "2026-08-16");
      result.current.updateForm("quantity", 12);
      result.current.updateForm("unitCost", 18.4);
      result.current.updateForm("price", 39.9);
    });
    submit(result);

    expect(lastPayload()).toMatchObject({
      supplierId: 10,
      entryDate: "2026-08-16T00:00:00",
      items: [{ productId: 201, quantity: 12, unitCost: 18.4, price: 39.9 }],
    });
    expect(lastPayload().entryDate).not.toContain("Z");
  });

  it("recusa o envio sem fornecedor e com quantidade zerada", () => {
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper: createWrapper() });

    submit(result);
    expect(mocks.receiveEntry).not.toHaveBeenCalled();

    act(() => {
      result.current.updateForm("supplierId", "10");
      result.current.updateForm("quantity", 0);
    });
    submit(result);

    expect(mocks.receiveEntry).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("recarrega entradas e produtos depois de gravar", async () => {
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper });

    act(() => result.current.setPage(2));
    await act(async () => receiveOptions().mutation.onSuccess());

    expect(result.current.page).toBe(1);
    expect(result.current.newEntryModalOpen).toBe(false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseEntriesQueryKey() });
    // Receber mercadoria grava custo, preço e saldo no PRODUTO: sem esta, a
    // listagem atrás da tela continuaria com o estoque de antes.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: RESOURCE_KEYS.products });
  });

  it("recarrega entradas e produtos depois de cancelar uma entrada", async () => {
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useProductStockEntries(201), { wrapper });

    act(() => result.current.openDetails(77));
    expect(result.current.selectedEntryId).toBe(77);

    await act(async () => deleteOptions().mutation.onSuccess());

    expect(result.current.detailsModalOpen).toBe(false);
    expect(result.current.selectedEntryId).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseEntriesQueryKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: RESOURCE_KEYS.products });
  });
});
