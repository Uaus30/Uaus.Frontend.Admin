import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import type { ProductTableRow } from "../../types";

const mocks = vi.hoisted(() => ({
  getProductById: vi.fn(),
  getAllSuppliers: vi.fn(),
  registerStockCount: vi.fn(),
}));

vi.mock("@/services/products.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/products.service")>()),
  getProductById: mocks.getProductById,
}));

vi.mock("@/services/suppliers.service", () => ({
  getAllSuppliers: mocks.getAllSuppliers,
}));

// Dubla só o que fala com a rede; as chaves de cache continuam as de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  registerStockCount: mocks.registerStockCount,
}));

const { useProductListStockCount, stockCountTargetId, canCountStock, LIST_STOCK_COUNT_NOTE } =
  await import("../useProductListStockCount");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const azul = { id: 986, name: "COPO [AZUL]", price: 9.9, stock: 3, status: PRODUCT_STATUS.Active };
const verde = { id: 987, name: "COPO [VERDE]", price: 9.9, stock: 12, status: PRODUCT_STATUS.Active };

/** Uma linha da listagem; `variations` vazia é produto simples. */
function linha(overrides: Partial<ProductTableRow> = {}): ProductTableRow {
  return {
    id: 987,
    productGroupId: 825,
    name: "COPO",
    productName: "COPO",
    description: null,
    barcode: "7891234567890",
    price: 9.9,
    costPrice: 5,
    stock: 15,
    minStock: 0,
    status: PRODUCT_STATUS.Active,
    variationCount: 2,
    variations: [azul, verde],
    productGroup: {
      id: 825,
      name: "COPO",
      description: null,
      hasVariations: true,
      showOnSite: true,
      notes: null,
    },
    category: { id: 5, name: "Utilidades" },
    department: { id: 2, name: "Casa" },
    tags: [],
    images: [],
    ...overrides,
  };
}

describe("stockCountTargetId — qual SKU a contagem alcança", () => {
  it("produto simples é a própria linha", () => {
    expect(stockCountTargetId(linha({ variations: [] }), null)).toBe(987);
  });

  it("grupo com uma variação vai direto para ela", () => {
    expect(stockCountTargetId(linha({ variations: [azul] }), null)).toBe(986);
  });

  it("com duas ou mais, só a ESCOLHIDA — e escolha que não é do grupo não vale", () => {
    // Contar na variação errada lança sobra numa e falta noutra.
    expect(stockCountTargetId(linha(), null)).toBeNull();
    expect(stockCountTargetId(linha(), 987)).toBe(987);
    expect(stockCountTargetId(linha(), 555)).toBeNull();
  });

  it("grupo sem produto nenhum não tem o que contar", () => {
    const vazio = linha({ id: 0, variations: [] });

    expect(stockCountTargetId(vazio, null)).toBeNull();
    expect(canCountStock(vazio)).toBe(false);
    expect(canCountStock(linha())).toBe(true);
  });
});

describe("useProductListStockCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllSuppliers.mockResolvedValue([{ id: 4, name: "Shopee" }]);
    // O saldo do SERVIDOR difere do da linha de propósito: a linha pode estar velha.
    mocks.getProductById.mockImplementation(async (id: number) => ({
      id,
      barcode: `789000000${id}`,
      stock: id === 986 ? 5 : 20,
      costPrice: 5,
    }));
  });

  it("a listagem abre sem pedir fornecedores — só a modal aberta pede", async () => {
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });
    expect(mocks.getAllSuppliers).not.toHaveBeenCalled();

    act(() => result.current.openFor(linha({ variations: [] })));

    await waitFor(() => expect(result.current.suppliers).toHaveLength(1));
  });

  it("produto simples: conta com o saldo lido do servidor, não o da linha", async () => {
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });

    act(() => result.current.openFor(linha({ variations: [], stock: 15 })));

    expect(result.current.count.open).toBe(true);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.currentStock).toBe(20);
    expect(result.current.variationChoices).toEqual([]);
  });

  it("grupo com variações: trava até a escolha, e trocar de variação apaga o número", async () => {
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });

    act(() => result.current.openFor(linha()));
    expect(result.current.ready).toBe(false);
    expect(result.current.variationChoices).toEqual([azul, verde]);
    expect(mocks.getProductById).not.toHaveBeenCalled();

    act(() => result.current.pickVariation(986));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.productName).toBe("COPO [AZUL]");
    expect(result.current.currentStock).toBe(5);

    act(() => result.current.count.updateForm({ counted: "4" }));
    act(() => result.current.pickVariation(987));

    expect(result.current.count.form.counted).toBe("");
  });

  it("sem observação, o documento diz que veio da listagem", async () => {
    // Sem isto o servidor grava "da conferência de produtos", e quem investigar
    // depois procura uma conferência que não existiu.
    mocks.registerStockCount.mockResolvedValue({
      productId: 986,
      productName: "COPO [AZUL]",
      previousStock: 5,
      countedStock: 4,
      difference: -1,
      stockWriteOffId: 31,
    });
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });

    act(() => result.current.openFor(linha({ variations: [azul] })));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.count.updateForm({ counted: "4" }));
    act(() => result.current.count.submit());

    await waitFor(() => expect(mocks.registerStockCount).toHaveBeenCalled());
    expect(mocks.registerStockCount).toHaveBeenCalledWith(
      986,
      expect.objectContaining({ countedQuantity: 4, notes: LIST_STOCK_COUNT_NOTE }),
    );
  });
});

describe("useProductListStockCount — o saldo é relido a cada abertura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllSuppliers.mockResolvedValue([]);
  });

  it("reabrir a mesma linha lê o saldo de novo — a prévia não usa o de antes", async () => {
    // Abriu com 5 e cancelou; o PDV vendeu 2. Com o saldo velho, contar 4 diria
    // "falta 1" e o servidor gravaria uma SOBRA de 1.
    mocks.getProductById.mockResolvedValueOnce({ id: 987, barcode: "1", stock: 5 });
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });

    act(() => result.current.openFor(linha({ variations: [] })));
    await waitFor(() => expect(result.current.currentStock).toBe(5));
    act(() => result.current.count.setOpen(false));

    mocks.getProductById.mockResolvedValueOnce({ id: 987, barcode: "1", stock: 3 });
    act(() => result.current.openFor(linha({ variations: [] })));

    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.currentStock).toBe(3));
    expect(mocks.getProductById).toHaveBeenCalledTimes(2);
  });

  it("trocar de variação apaga também o fornecedor e o custo — são de outro lote", async () => {
    mocks.getProductById.mockImplementation(async (id: number) => ({ id, barcode: "1", stock: 2 }));
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });

    act(() => result.current.openFor(linha()));
    act(() => result.current.pickVariation(986));
    act(() =>
      result.current.count.updateForm({ counted: "9", supplierId: "4", unitCost: "2.5", notes: "caixa" }),
    );
    act(() => result.current.pickVariation(987));

    expect(result.current.count.form).toEqual({ counted: "", supplierId: "", unitCost: "", notes: "caixa" });
  });

  it("leitura que falhou trava a contagem com a mensagem, e tentar de novo relê", async () => {
    mocks.getProductById.mockRejectedValueOnce(new Error("rede fora"));
    const { result } = renderHook(() => useProductListStockCount(), { wrapper: createWrapper() });

    act(() => result.current.openFor(linha({ variations: [] })));
    await waitFor(() => expect(result.current.loadError).not.toBeNull());
    expect(result.current.ready).toBe(false);

    mocks.getProductById.mockResolvedValueOnce({ id: 987, barcode: "1", stock: 6 });
    act(() => result.current.retryLoad());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.loadError).toBeNull();
    expect(result.current.currentStock).toBe(6);
  });
});
