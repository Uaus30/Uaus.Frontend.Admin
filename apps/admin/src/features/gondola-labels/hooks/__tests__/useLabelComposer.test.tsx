import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  createProductLabelBatch: vi.fn(),
  searchPdvProducts: vi.fn(),
  printLabelSheet: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado — enums, chaves de cache e helpers puros
// vêm do módulo real, para o teste bater contra o contrato de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createProductLabelBatch: mocks.createProductLabelBatch,
  searchPdvProducts: mocks.searchPdvProducts,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../../print", () => ({
  printLabelSheet: mocks.printLabelSheet,
}));

const { useLabelComposer } = await import("../useLabelComposer");

/** Produto devolvido pela busca do balcão; só os campos que o hook usa. */
function product(id: number, patch?: Partial<ProductPdvSearchDto>): ProductPdvSearchDto {
  return {
    id,
    name: `Produto ${id}`,
    barcode: `789000000000${id}`,
    price: 12.5,
    stock: 5,
    ...patch,
  } as ProductPdvSearchDto;
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLabelComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchPdvProducts.mockResolvedValue([]);
    mocks.printLabelSheet.mockResolvedValue(undefined);
    mocks.createProductLabelBatch.mockResolvedValue({
      id: 1,
      createdAt: "2026-08-07T10:00:00",
      updatedAt: null,
      description: null,
      userId: 3,
      userName: "Ana",
      totalProducts: 1,
      totalLabels: 2,
      items: [
        {
          id: 10,
          productId: 5,
          productName: "CANECA",
          barcode: "7891234567895",
          price: 9.99,
          labelType: "Promotion",
          labelTypeName: "Promoção",
          quantity: 2,
        },
      ],
    });
  });

  it("abre sem buscar nada — a lista de produtos nasce vazia", () => {
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.hasSearched).toBe(false);
  });

  it("adiciona o produto com tipo Normal e preço do cadastro", () => {
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    act(() => result.current.addProduct(product(5, { price: 12.5 })));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      productId: 5,
      labelType: 1,
      priceInput: "12,50",
      quantityInput: "1",
    });
    expect(result.current.totalLabels).toBe(1);
  });

  it("soma uma cópia ao adicionar o mesmo produto de novo no tipo Normal", () => {
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.addProduct(product(5)));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantityInput).toBe("2");
    expect(result.current.totalLabels).toBe(2);
  });

  it("permite o mesmo produto com tipos diferentes, mas bloqueia tipo repetido", () => {
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.updateItem(0, { labelType: 2 }));
    act(() => result.current.addProduct(product(5)));

    expect(result.current.items).toHaveLength(2);

    // Tentar transformar a linha Normal em Promoção repetiria o par produto+tipo.
    act(() => result.current.updateItem(1, { labelType: 2 }));

    expect(result.current.items[1].labelType).toBe(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("barra a geração quando algum item tem preço ou quantidade inválidos", async () => {
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.updateItem(0, { priceInput: "0" }));

    await act(async () => result.current.handleGenerate());

    expect(mocks.createProductLabelBatch).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("gera o lote com os valores digitados e imprime o que o backend congelou", async () => {
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    act(() => result.current.addProduct(product(5)));
    act(() => result.current.updateItem(0, { labelType: 2, priceInput: "9,99", quantityInput: "2" }));
    act(() => result.current.setDescription("Promoção da semana"));

    await act(async () => result.current.handleGenerate());

    expect(mocks.createProductLabelBatch).toHaveBeenCalledWith({
      description: "Promoção da semana",
      items: [{ productId: 5, labelType: 2, price: 9.99, quantity: 2 }],
    });

    expect(mocks.printLabelSheet).toHaveBeenCalledWith([
      {
        productName: "CANECA",
        barcode: "7891234567895",
        price: 9.99,
        labelType: 2,
        quantity: 2,
      },
    ]);

    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(result.current.description).toBe("");
  });
});
