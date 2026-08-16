import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProductSearchOption } from "@/components/product-search-picker";

const mocks = vi.hoisted(() => ({
  receiveEntry: vi.fn(),
  useReceivePurchaseEntry: vi.fn(),
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
  useDeletePurchaseEntry: vi.fn(() => ({ mutate: vi.fn() })),
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
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

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
  });

  it("deve iniciar com o formulário vazio", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.newEntryModalOpen).toBe(false);
    expect(result.current.supplierId).toBe("");
    expect(result.current.items).toEqual([]);
  });

  it("deve lançar o produto da busca já com custo e preço sugeridos", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.handleAddItem(product(201)));

    expect(result.current.items).toEqual([
      {
        productId: 201,
        productName: "Produto 201",
        barcode: "789201",
        quantity: 1,
        unitCost: 4.5,
        price: 9.9,
      },
    ]);
  });

  it("deve somar o produto repetido na linha existente em vez de duplicá-la", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.handleAddItem(product(5), 2));
    act(() => result.current.handleAddItem(product(9), 1));
    act(() => result.current.handleAddItem(product(5), 3));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ productId: 5, quantity: 5 });
  });

  it("deve editar quantidade, custo e preço da linha e removê-la", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => result.current.handleAddItem(product(5)));
    act(() => result.current.handleItemChange(0, "quantity", 12));
    act(() => result.current.handleItemChange(0, "unitCost", 3.21));
    act(() => result.current.handleItemChange(0, "price", 7.5));

    expect(result.current.items[0]).toMatchObject({ quantity: 12, unitCost: 3.21, price: 7.5 });

    act(() => result.current.handleRemoveItem(0));
    expect(result.current.items).toEqual([]);
  });

  it("deve enviar a data como instante LOCAL, sem o 'Z' do toISOString", () => {
    // Regressão do 500 ao salvar: `entry_date` é `timestamp without time zone` e
    // o Npgsql recusa um DateTime com Kind=Utc. `new Date("2026-08-16").toISOString()`
    // devolvia "2026-08-16T00:00:00.000Z" e derrubava a gravação.
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    fillHeader(result);
    act(() => result.current.handleAddItem(product(201)));
    act(() => result.current.handleSaveEntry({ preventDefault: vi.fn() } as unknown as React.FormEvent));

    expect(lastPayload()).toMatchObject({
      supplierId: 10,
      entryDate: "2026-08-16T00:00:00",
      items: [{ productId: 201, quantity: 1, unitCost: 4.5, price: 9.9 }],
    });
    expect(lastPayload().entryDate).not.toContain("Z");
  });

  it("deve recusar o envio sem fornecedor ou sem itens", () => {
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

  it("deve limpar o formulário inteiro no reset", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    fillHeader(result);
    act(() => {
      result.current.setInvoiceNumber("NF-1234");
      result.current.setNotes("frete por conta do fornecedor");
      result.current.handleAddItem(product(5));
    });
    act(() => result.current.resetNewEntryForm());

    expect(result.current.supplierId).toBe("");
    expect(result.current.invoiceNumber).toBe("");
    expect(result.current.notes).toBe("");
    expect(result.current.items).toEqual([]);
  });
});
