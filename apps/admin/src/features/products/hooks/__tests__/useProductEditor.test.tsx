import { renderHook, act } from "@testing-library/react";
import { useProductEditor } from "../useProductEditor";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

vi.mock("@/services/grades.service", () => ({
  getAllGrades: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/tags.service", () => ({
  getAllTags: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/images.service", () => ({
  getAllImages: vi.fn(() => Promise.resolve([])),
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 1, url: "img.png" })),
}));

vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([])),
  buildPublicImageUrl: vi.fn((url) => url),
}));

vi.mock("@/hooks/use-toast", () => ({
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

  it("should initialize default form values and modal status", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    expect(result.current.modalOpen).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.form.productGroupName).toBe("");
    expect(result.current.form.hasVariations).toBe(false);
  });

  it("should handle openModal in create mode", () => {
    const { result } = renderHook(() => useProductEditor(), { wrapper: createWrapper() });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingGroupId).toBeNull();
  });

  it("should handle openModal in edit mode", () => {
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
        isPublic: true,
      },
      tags: [],
      images: [],
    };

    act(() => {
      result.current.openModal(mockProduct);
    });

    expect(result.current.modalOpen).toBe(true);
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
});
