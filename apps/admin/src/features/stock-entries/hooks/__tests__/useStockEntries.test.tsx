import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetPurchaseEntriesQueryKey } from "@workspace/api-client-react";
import type { ProductSearchOption } from "@/components/product-search-picker";

const mocks = vi.hoisted(() => ({
  receiveEntry: vi.fn(),
  useReceivePurchaseEntry: vi.fn(),
  deleteEntry: vi.fn(),
  useDeletePurchaseEntry: vi.fn(),
  getProductById: vi.fn(),
}));

vi.mock("@/services/suppliers.service", () => ({
  getAllSuppliers: vi.fn(() => Promise.resolve([{ id: 10, name: "Supp 10" }])),
}));

vi.mock("@/services/products.service", () => ({
  getProductById: mocks.getProductById,
}));

// Dubla só o que fala com a rede; o resto do api-client (chaves de cache
// inclusive) continua sendo o de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchaseEntries: vi.fn(() => ({
    data: {
      data: [{ id: 1, entryDate: "2026-06-18T22:00:00", supplierId: 10, invoiceNumber: "123", total: 1000 }],
      total: 1,
      totalPages: 1,
    },
    isLoading: false,
    refetch: vi.fn(),
    isError: false,
    error: null,
  })),
  useGetPurchaseEntryDetails: vi.fn(() => ({ data: undefined, isLoading: false })),
  useReceivePurchaseEntry: mocks.useReceivePurchaseEntry,
  useDeletePurchaseEntry: mocks.useDeletePurchaseEntry,
}));

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const { useStockEntries } = await import("../useStockEntries");

/** Produto como a busca compartilhada o devolve. */
function product(id: number, name = `Produto ${id}`): ProductSearchOption {
  return { id, name, barcode: `789${id}`, stock: 50, price: 9.9, costPrice: 4.5 };
}

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Object.assign(wrapper, { queryClient });
};

/** Opções que o hook passou para a mutation de recebimento (para disparar o onSuccess). */
function receiveOptions() {
  return mocks.useReceivePurchaseEntry.mock.calls.at(-1)?.[0];
}

/** Idem, para a mutation de exclusão. */
function deleteOptions() {
  return mocks.useDeletePurchaseEntry.mock.calls.at(-1)?.[0];
}

/** Carga enviada ao backend na última chamada de `receiveEntry`. */
function lastPayload() {
  return mocks.receiveEntry.mock.calls.at(-1)?.[0]?.data;
}

/** Preenche o cabeçalho mínimo para o formulário passar da validação. */
function fillHeader(result: { current: ReturnType<typeof useStockEntries> }) {
  act(() => {
    result.current.setSupplierId("10");
    result.current.setEntryDate("2026-08-16");
  });
}

describe("useStockEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useReceivePurchaseEntry.mockReturnValue({ mutate: mocks.receiveEntry, isPending: false });
    mocks.useDeletePurchaseEntry.mockReturnValue({ mutate: mocks.deleteEntry });
  });

  it("deve iniciar com o formulário vazio", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.newEntryModalOpen).toBe(false);
    expect(result.current.supplierId).toBe("");
    expect(result.current.item).toBeNull();
  });

  it("deve lançar o produto da busca já com custo, preço e estoque sugeridos", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.handleSelectProduct(product(201)));

    expect(result.current.item).toEqual({
      productId: 201,
      productName: "Produto 201",
      barcode: "789201",
      stock: 50,
      quantity: 1,
      unitCost: 4.5,
      price: 9.9,
    });
  });

  it("deve TROCAR o produto ao escolher outro — a entrada é de um produto só", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.handleSelectProduct(product(5)));
    act(() => result.current.handleSelectProduct(product(9)));

    expect(result.current.item).toMatchObject({ productId: 9 });
  });

  it("deve editar quantidade, custo e preço e limpar o produto", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.handleSelectProduct(product(5)));
    act(() => result.current.handleItemChange("quantity", 12));
    act(() => result.current.handleItemChange("unitCost", 3.21));
    act(() => result.current.handleItemChange("price", 7.5));

    expect(result.current.item).toMatchObject({ quantity: 12, unitCost: 3.21, price: 7.5 });

    act(() => result.current.handleClearProduct());
    expect(result.current.item).toBeNull();
  });

  it("deve enviar a data como instante LOCAL, sem o 'Z' do toISOString", () => {
    // Regressão do 500 ao salvar: `entry_date` é `timestamp without time zone` e
    // o Npgsql recusa um DateTime com Kind=Utc. `new Date("2026-08-16").toISOString()`
    // devolvia "2026-08-16T00:00:00.000Z" e derrubava a gravação.
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    fillHeader(result);
    act(() => result.current.handleSelectProduct(product(201)));
    act(() => result.current.handleSaveEntry({ preventDefault: vi.fn() } as unknown as React.FormEvent));

    expect(lastPayload()).toMatchObject({
      supplierId: 10,
      entryDate: "2026-08-16T00:00:00",
      items: [{ productId: 201, quantity: 1, unitCost: 4.5, price: 9.9 }],
    });
    expect(lastPayload().entryDate).not.toContain("Z");
  });

  it("deve recusar o envio sem fornecedor ou sem produto", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });
    const submit = () =>
      act(() => result.current.handleSaveEntry({ preventDefault: vi.fn() } as unknown as React.FormEvent));

    submit();
    expect(mocks.receiveEntry).not.toHaveBeenCalled();

    fillHeader(result);
    submit();
    expect(mocks.receiveEntry).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("deve recusar preço de venda zero — ele passa a valer no cadastro do produto", () => {
    // Regressão: o backend gravava o `price` do item como preço de venda do
    // produto; zero aqui zerava o preço da loja em silêncio.
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    fillHeader(result);
    act(() => result.current.handleSelectProduct(product(201)));
    act(() => result.current.handleItemChange("price", 0));
    act(() => result.current.handleSaveEntry({ preventDefault: vi.fn() } as unknown as React.FormEvent));

    expect(mocks.receiveEntry).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
  });

  it("deve recusar quantidade fracionada — o backend só aceita inteiro", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    fillHeader(result);
    act(() => result.current.handleSelectProduct(product(201)));
    act(() => result.current.handleItemChange("quantity", 1.5));
    act(() => result.current.handleSaveEntry({ preventDefault: vi.fn() } as unknown as React.FormEvent));

    expect(mocks.receiveEntry).not.toHaveBeenCalled();
  });

  it("deve voltar para a primeira página e recarregar a listagem ao salvar", async () => {
    // A chave de invalidação NÃO é redefinida no mock: quem vale é a que a
    // própria query registra. Uma chave inventada aqui passaria no teste e
    // deixaria a tela sem atualizar na prática (armadilha 1 do CLAUDE.md).
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useStockEntries(), { wrapper });

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    await act(async () => receiveOptions().mutation.onSuccess());

    expect(result.current.page).toBe(1);
    expect(result.current.newEntryModalOpen).toBe(false);
    expect(result.current.item).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseEntriesQueryKey() });
  });

  it("deve recarregar a listagem inteira ao excluir uma entrada", async () => {
    const wrapper = createWrapper();
    const invalidateSpy = vi.spyOn(wrapper.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useStockEntries(), { wrapper });

    await act(async () => deleteOptions().mutation.onSuccess());

    expect(result.current.detailsModalOpen).toBe(false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseEntriesQueryKey() });
  });

  it("deve voltar para a primeira página ao trocar o filtro de fornecedor", () => {
    // Sem isso, filtrar estando na página 3 mostraria "nenhuma entrada" só
    // porque o novo recorte tem menos páginas que o anterior.
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    act(() => result.current.setSelectedSupplierFilter("10"));

    expect(result.current.selectedSupplierFilter).toBe("10");
    expect(result.current.page).toBe(1);
  });

  it("deve limpar o formulário inteiro no reset", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    fillHeader(result);
    act(() => {
      result.current.setInvoiceNumber("NF-1234");
      result.current.setNotes("frete por conta do fornecedor");
      result.current.handleSelectProduct(product(5));
    });
    act(() => result.current.resetNewEntryForm());

    expect(result.current.supplierId).toBe("");
    expect(result.current.invoiceNumber).toBe("");
    expect(result.current.notes).toBe("");
    expect(result.current.item).toBeNull();
  });
});
