import { renderHook, act, waitFor } from "@testing-library/react";
import { useProductTable } from "../useProductTable";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { upsertProduct } from "@/services/products.service";

// O produto real ("Caneca Personalizada 300ml") pertence ao grupo "Caneca
// Personalizada" — nomes distintos de propósito, para flagrar o PUT errado.
const realProduct = {
  id: 10,
  productGroupId: 1,
  name: "Caneca Personalizada 300ml",
  description: "Caneca de porcelana",
  barcode: "789000000001",
  price: 25,
  costPrice: 10,
  stock: 5,
  minStock: 1,
  status: 2,
  canDelete: true,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
};

const productGroup = {
  id: 1,
  categoryId: 5,
  name: "Caneca Personalizada",
  description: null,
  hasVariations: false,
  showOnSite: true,
  canDelete: true,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
};

vi.mock("@/services/products.service", () => ({
  getAllProducts: vi.fn(() => Promise.resolve([
    {
      id: 10,
      productGroupId: 1,
      name: "Caneca Personalizada 300ml",
      description: "Caneca de porcelana",
      barcode: "789000000001",
      price: 25,
      costPrice: 10,
      stock: 5,
      minStock: 1,
      status: 2,
      canDelete: true,
      createdAt: "2026-01-01T00:00:00",
      updatedAt: null,
    },
  ])),
  getAllProductImages: vi.fn(() => Promise.resolve([])),
  getAllProductTags: vi.fn(() => Promise.resolve([])),
  getProductGroupsPage: vi.fn(() => Promise.resolve({
    data: [
      {
        id: 1,
        categoryId: 5,
        name: "Caneca Personalizada",
        description: null,
        hasVariations: false,
        showOnSite: true,
        canDelete: true,
        createdAt: "2026-01-01T00:00:00",
        updatedAt: null,
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  })),
  upsertProduct: vi.fn(() => Promise.resolve({ id: 10, canDelete: true })),
  adjustProductStock: vi.fn(() => Promise.resolve({ id: 10 })),
  syncProductImages: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([])),
  getAllDepartments: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/tags.service", () => ({
  getAllTags: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/images.service", () => ({
  getAllImages: vi.fn(() => Promise.resolve([])),
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 99, url: "img.png" })),
  buildImageProxyUrl: vi.fn((url: string) => url),
}));

vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/mappers", () => ({
  buildProductCollections: vi.fn(() => ({
    enrichedProducts: [
      {
        id: 10,
        productGroupId: 1,
        name: "Caneca Personalizada 300ml",
        description: "Caneca de porcelana",
        barcode: "789000000001",
        price: 25,
        costPrice: 10,
        stock: 5,
        minStock: 1,
        status: 2,
        canDelete: true,
        productGroup: {
          id: 1,
          categoryId: 5,
          name: "Caneca Personalizada",
          description: null,
          hasVariations: false,
          showOnSite: true,
          canDelete: true,
          createdAt: "2026-01-01T00:00:00",
          updatedAt: null,
        },
      },
    ],
  })),
}));

vi.mock("@workspace/api-client-react", () => ({
  getAuthSession: vi.fn(() => null),
}));

vi.mock("@/lib/imageOptimizer", () => ({
  optimizeImage: vi.fn((file: File) => Promise.resolve({
    file,
    optimized: false,
    originalSize: 0,
    optimizedSize: 0,
  })),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("useProductTable Hook", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve exibir o nome do grupo na tabela sem perder o produto original", async () => {
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));
    expect(result.current.enrichedProducts[0].name).toBe(productGroup.name);
  });

  it("deve enviar o nome ORIGINAL do produto na edição inline de preço", async () => {
    // Regressão: a linha da tabela troca o nome pelo nome do GRUPO para
    // exibição; o PUT com esse objeto renomeava o produto silenciosamente
    // (com registro no histórico), afetando cupom e PDV.
    const { result } = renderHook(() => useProductTable(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.enrichedProducts).toHaveLength(1));
    // Garante que a lista completa de produtos (fonte do nome real) carregou
    await waitFor(() =>
      expect(queryClient.getQueryData(["products-all-for-table"])).toBeTruthy(),
    );

    const rowProduct = result.current.enrichedProducts[0];
    expect(rowProduct.name).toBe(productGroup.name);

    await act(async () => {
      await result.current.updateProductPrice(rowProduct, 29.9);
    });

    expect(upsertProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: realProduct.id,
        name: realProduct.name,
        description: realProduct.description,
        barcode: realProduct.barcode,
        price: 29.9,
      }),
    );
  });
});
