import { renderHook, act } from "@testing-library/react";
import { useProductEditor } from "../useProductEditor";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { syncProductImages } from "@/services/products.service";
import { createImageFromFile } from "@/services/images.service";

const mocks = vi.hoisted(() => ({
  saveProductGroupWithProducts: vi.fn(() =>
    Promise.resolve({ group: { id: 1 }, products: [{ id: 10, canDelete: true }] }),
  ),
  markPurchaseReceived: vi.fn(() => Promise.resolve({})),
}));

// Dubla só o que fala com a rede; o resto do api-client continua o de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  saveProductGroupWithProducts: mocks.saveProductGroupWithProducts,
  markPurchaseReceived: mocks.markPurchaseReceived,
}));

// Mock services and utilities
vi.mock("@/services/products.service", () => ({
  getAllProducts: vi.fn(() => Promise.resolve([])),
  getAllProductImages: vi.fn(() => Promise.resolve([])),
  getAllProductTags: vi.fn(() => Promise.resolve([])),
  getProductsPage: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
  syncProductTags: vi.fn(() => Promise.resolve()),
  syncProductImages: vi.fn(() => Promise.resolve()),
  deleteProduct: vi.fn(() => Promise.resolve()),
  deleteProductGroup: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([])),
  getGradesByCategoryId: vi.fn(() => Promise.resolve([])),
  getAllDepartments: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/tags.service", () => ({
  getAllTags: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/images.service", () => ({
  getAllImages: vi.fn(() => Promise.resolve([])),
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 99, url: "img.png" })),
}));

vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([])),
  buildPublicImageUrl: vi.fn((url) => url),
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useProductEditor Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize default form values and detail status", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    expect(result.current.detailOpen).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.form.productGroupName).toBe("");
    expect(result.current.form.hasVariations).toBe(false);
  });

  it("should handle openDetail in create mode", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail();
    });

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
  });

  it("should handle openDetail in edit mode", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const mockProduct = {
      id: 10,
      name: "COPO VERDE",
      price: 15.5,
      barcode: "123456",
      productGroup: {
        id: 1,
        name: "COPO",
        description: "Desc",
        hasVariations: false,
        showOnSite: true,
      },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openDetail(mockProduct);
    });

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBe(1);
    expect(result.current.productEditor.name).toBe("COPO VERDE");
    expect(result.current.productEditor.price).toBe(15.5);
  });

  it("should reset HasVariations correctly when toggled", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.toggleHasVariations(true);
    });

    expect(result.current.form.hasVariations).toBe(true);
    expect(result.current.variationDrafts.length).toBe(0);
  });

  it("deve persistir descrição e visibilidade (showOnSite) do grupo ao salvar", async () => {
    // Regressão: persistGroup não enviava description (o PUT mandava null e o
    // backend apagava a descrição do banco) nem a visibilidade do switch.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const mockProduct = {
      id: 10,
      name: "COPO VERDE",
      description: "",
      price: 15.5,
      stock: 2,
      minStock: 0,
      status: 2,
      barcode: "123456",
      department: { id: 2 },
      category: { id: 5 },
      productGroup: {
        id: 1,
        name: "COPO",
        description: "Descrição original",
        hasVariations: false,
        showOnSite: false,
      },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openDetail(mockProduct);
    });

    // O formulário carrega os valores persistidos do grupo
    expect(result.current.form.description).toBe("Descrição original");
    expect(result.current.form.isPublic).toBe(false);

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    });

    // O salvamento é UMA chamada atômica: grupo e produto viajam juntos.
    expect(mocks.saveProductGroupWithProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 1,
        categoryId: 5,
        name: "COPO",
        description: "Descrição original",
        hasVariations: false,
        showOnSite: false,
        products: [expect.objectContaining({ id: 10, name: "COPO VERDE" })],
      }),
    );
  });

  it("deve preservar a posição escolhida para imagens novas ao salvar", async () => {
    // Regressão: as imagens recém-enviadas eram concatenadas no FIM da lista,
    // ignorando a ordem definida por drag-and-drop (a capa "pulava" de lugar).
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    const mockProduct = {
      id: 10,
      name: "COPO VERDE",
      description: "",
      price: 15.5,
      stock: 2,
      minStock: 0,
      status: 2,
      barcode: "123456",
      department: { id: 2 },
      category: { id: 5 },
      productGroup: { id: 1, name: "COPO", description: "", hasVariations: false, showOnSite: true },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openDetail(mockProduct);
    });

    // Usuário adiciona a imagem nova "C" e a arrasta para a primeira posição
    act(() => {
      result.current.setImages([
        { name: "C", url: "blob:c", file: new File(["c"], "c.png", { type: "image/png" }) },
        { imageId: 1, associationId: 100, name: "A", url: "a.png" },
        { imageId: 2, associationId: 101, name: "B", url: "b.png" },
      ]);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    });

    expect(createImageFromFile).toHaveBeenCalledTimes(1);
    expect(syncProductImages).toHaveBeenCalledWith(
      expect.objectContaining({
        nextImages: [
          { imageId: 99, displayOrder: 0 },
          { imageId: 1, displayOrder: 1 },
          { imageId: 2, displayOrder: 2 },
        ],
      }),
    );
  });

  it("deve manter a tela aberta depois de salvar um produto simples, ja com o id do grupo", async () => {
    // Desde 05/09/2026 o cadastro novo NAO fecha ao salvar: o operador segue
    // para a aba Estoque e lanca a entrada do que acabou de receber. Antes a
    // tela fechava e ele tinha que procurar o produto na lista para voltar.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail();
    });
    act(() => {
      result.current.setForm((current) => ({ ...current, categoryId: "5", productGroupName: "COPO" }));
      result.current.setProductEditor((current) => ({ ...current, name: "COPO", price: 10, status: "2" }));
    });
    expect(result.current.isDirty).toBe(true);

    let gravou = false;
    await act(async () => {
      gravou = await result.current.handleSubmit();
    });

    expect(gravou).toBe(true);
    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBe(1);
    expect(result.current.productEditor.id).toBe(10);
    // O que esta na tela e o que o servidor gravou — nao conta mais como alterado.
    expect(result.current.isDirty).toBe(false);
  });

  it("deve devolver falso quando o servidor recusa, para o Avancar nao trocar de aba", async () => {
    mocks.saveProductGroupWithProducts.mockRejectedValueOnce(new Error("codigo de barras duplicado"));
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetail();
    });
    act(() => {
      result.current.setForm((current) => ({ ...current, categoryId: "5", productGroupName: "COPO" }));
      result.current.setProductEditor((current) => ({ ...current, name: "COPO", price: 10, status: "2" }));
    });

    let gravou = true;
    await act(async () => {
      gravou = await result.current.handleSubmit();
    });

    expect(gravou).toBe(false);
    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
  });
});

describe("cadastro a partir de uma compra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const compra = {
    id: 5,
    createdAt: "2026-09-05T10:00:00",
    updatedAt: null,
    supplierId: 1,
    supplierName: "Shopee",
    productId: null,
    productGroupId: null,
    productName: "CANECA TERMICA",
    productBarcode: null,
    details: "500ml",
    purchaseLink: null,
    quantity: 3,
    grossTotal: 120,
    finalTotal: 100,
    unitGross: 40,
    unitFinal: 33.33,
    adjustmentPercent: -16.67,
    status: "Pending",
    receivedAt: null,
    purchaseEntryId: null,
    userName: null,
    images: [{ imageId: 9, url: "produtos/caneca.jpg", displayOrder: 0 }],
  };

  it("abre o cadastro novo preenchido pela compra e fecha a compra depois da entrada", async () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetailFromPurchase(compra);
    });

    expect(result.current.detailOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
    expect(result.current.form.productGroupName).toBe("CANECA TERMICA");
    expect(result.current.form.description).toBe("500ml");
    expect(result.current.productEditor.name).toBe("CANECA TERMICA");
    // 40% de margem sobre o custo unitário FINAL (33,33 / 0,6 = 55,55), no
    // múltiplo de 10 centavos mais próximo — 55,50 dá 39,9% de margem.
    expect(result.current.productEditor.price).toBe(55.5);
    // As fotos entram JÁ enviadas (imageId): o salvar só cria a associação.
    expect(result.current.images).toEqual([
      { imageId: 9, name: "CANECA TERMICA", url: expect.stringContaining("caneca.jpg") },
    ]);
    expect(result.current.purchaseContext).toMatchObject({
      purchaseId: 5,
      supplierId: 1,
      quantity: 3,
      unitCost: 33.33,
    });
    // Preenchido pela compra não é "alterado pelo operador".
    expect(result.current.isDirty).toBe(false);

    await act(async () => {
      await result.current.completePurchaseReceipt(10, 77);
    });

    expect(mocks.markPurchaseReceived).toHaveBeenCalledWith(5, { productId: 10, purchaseEntryId: 77 });
    expect(result.current.purchaseContext).toBeNull();
  });

  it("fechar a tela descarta o contexto da compra", () => {
    // Um cadastro aberto depois pela lista não pode herdar a entrada de um
    // pedido que não é dele.
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openDetailFromPurchase(compra);
    });
    act(() => {
      result.current.resetForm();
    });

    expect(result.current.purchaseContext).toBeNull();
    expect(result.current.form.productGroupName).toBe("");
  });

  it("sem contexto de compra, fechar o recebimento não chama a API", async () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.completePurchaseReceipt(10, 77);
    });

    expect(mocks.markPurchaseReceived).not.toHaveBeenCalled();
  });
});
