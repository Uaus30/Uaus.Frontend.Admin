import { renderHook, act } from "@testing-library/react";
import { useInventory } from "../useInventory";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiGetOrThrow } from "@workspace/api-client-react";

// Mock the services
vi.mock("@/services/suppliers.service", () => ({
  getAllSuppliers: vi.fn(() => Promise.resolve([{ id: 10, name: "Supp 10" }])),
}));

vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([{ id: 101, name: "Cat 101" }])),
}));

// Mock api client react hook
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetInventoryReport: vi.fn(() => ({
    data: {
      metrics: {
        totalProductsWithControl: 5,
        totalUnits: 100,
        totalValueMerchandise: 1000,
        totalValueCost: 500,
        totalEstimatedProfit: 500,
        marginPercentage: 50,
        alertsNoStock: 0,
        alertsLowStock: 0,
      },
      categorySummaries: [],
      items: {
        data: [],
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  })),
  apiGetOrThrow: vi.fn(() => Promise.resolve({ items: [] })),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Helper wrapper for React Query
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

describe("useInventory Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useInventory(), { wrapper: createWrapper() });

    expect(result.current.search).toBe("");
    expect(result.current.selectedSupplier).toBe("all");
    expect(result.current.selectedCategory).toBe("all");
    expect(result.current.stockStatus).toBe("all");
    expect(result.current.page).toBe(1);
    expect(result.current.zoomScale).toBe(1.0);
  });

  it("should handle zoom actions correctly", () => {
    const { result } = renderHook(() => useInventory(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleZoomIn();
    });
    expect(result.current.zoomScale).toBeCloseTo(1.1);

    act(() => {
      result.current.handleZoomOut();
      result.current.handleZoomOut();
    });
    expect(result.current.zoomScale).toBeCloseTo(0.9);

    act(() => {
      result.current.handleResetZoom();
    });
    expect(result.current.zoomScale).toBe(1.0);
  });
});

describe("useInventory handleExportExcel", () => {
  let capturedBlob: Blob | null = null;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedBlob = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock";
    }) as typeof URL.createObjectURL;
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  });

  it("deve exportar lendo o objeto paginado da API (result.items.items)", async () => {
    // Regressão: GET /Inventory devolve InventoryReportDto cujo `items` é um
    // PagedResult ({ items: [...], pagination }), não um array — ler
    // `result.items` como array quebrava a exportação com TypeError.
    vi.mocked(apiGetOrThrow).mockResolvedValue({
      metrics: {},
      categorySummaries: [],
      items: {
        items: [
          {
            productName: "Produto X",
            barcode: "789",
            supplierName: "Fornecedor A",
            categoryName: "Categoria B",
            stock: 2,
            unitCost: 5,
            unitSale: 10,
          },
          {
            productName: "Sem Estoque",
            barcode: "",
            supplierName: "Fornecedor A",
            categoryName: "Categoria B",
            stock: 0,
            unitCost: 5,
            unitSale: 10,
          },
        ],
        pagination: { page: 1, size: 100000, totalItems: 2, filteredItems: 2 },
      },
    });

    const { result } = renderHook(() => useInventory(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Exportado" }),
    );
    expect(capturedBlob).not.toBeNull();

    const csv = await capturedBlob!.text();
    expect(csv).toContain("Produto;Cód. Barras;Fornecedor;Categoria");
    // mercadoria=20, custo=10, lucro=10 -> margem 50,0%
    expect(csv).toContain('"Produto X"');
    expect(csv).toContain("50,0%");
    // Regressão da margem: com estoque zerado a divisão dava NaN%.
    expect(csv).toContain('"Sem Estoque"');
    expect(csv).not.toContain("NaN");
  });

  it("deve avisar quando o filtro não retorna registros, sem gerar arquivo", async () => {
    vi.mocked(apiGetOrThrow).mockResolvedValue({
      metrics: {},
      categorySummaries: [],
      items: { items: [], pagination: { page: 1, size: 100000, totalItems: 0, filteredItems: 0 } },
    });

    const { result } = renderHook(() => useInventory(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro na exportação",
        description: "Não há registros correspondentes aos filtros selecionados para exportar.",
      }),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
