import { renderHook, act } from "@testing-library/react";
import { useProductEditor } from "../useProductEditor";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { updateProductGroup, syncProductImages } from "@/services/products.service";
import { createImageFromFile } from "@/services/images.service";

// Mock services and utilities
vi.mock("@/services/products.service", () => ({
  getAllProducts: vi.fn(() => Promise.resolve([])),
  getAllProductImages: vi.fn(() => Promise.resolve([])),
  getAllProductTags: vi.fn(() => Promise.resolve([])),
  getProductsPage: vi.fn(() => Promise.resolve({ data: [], total: 0 })),
  createProductGroup: vi.fn(() => Promise.resolve({ id: 1 })),
  updateProductGroup: vi.fn(() => Promise.resolve({ id: 1 })),
  upsertProduct: vi.fn(() => Promise.resolve({ id: 10, canDelete: true })),
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

    expect(updateProductGroup).toHaveBeenCalledWith({
      id: 1,
      categoryId: 5,
      name: "COPO",
      description: "Descrição original",
      hasVariations: false,
      showOnSite: false,
    });
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
});
