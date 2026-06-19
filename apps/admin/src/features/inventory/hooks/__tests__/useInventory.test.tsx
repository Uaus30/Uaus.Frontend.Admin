import { renderHook, act } from "@testing-library/react";
import { useInventory } from "../useInventory";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/suppliers.service", () => ({
  getAllSuppliers: vi.fn(() => Promise.resolve([{ id: 10, name: "Supp 10" }])),
}));

vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([{ id: 101, name: "Cat 101" }])),
}));

// Mock api client react hook
vi.mock("@workspace/api-client-react", () => ({
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
  apiGet: vi.fn(() => Promise.resolve({ items: [] })),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
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
