import { renderHook, act } from "@testing-library/react";
import { useStockEntries } from "../useStockEntries";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/suppliers.service", () => ({
  getAllSuppliers: vi.fn(() => Promise.resolve([{ id: 10, name: "Supp 10" }])),
}));

vi.mock("@/services/products.service", () => ({
  getAllProducts: vi.fn(() => Promise.resolve([{ id: 201, name: "Prod 201", price: 100, costPrice: 50 }])),
}));

// Mock api client react hook queries and mutations
vi.mock("@workspace/api-client-react", () => ({
  useGetPurchaseEntries: vi.fn(() => ({
    data: {
      data: [{ id: 1, entryDate: "2026-06-18T22:00:00Z", supplierId: 10, invoiceNumber: "123", total: 1000 }],
      total: 1,
      totalPages: 1,
    },
    isLoading: false,
    refetch: vi.fn(),
    isError: false,
    error: null,
  })),
  useGetPurchaseEntryDetails: vi.fn(() => ({
    data: {
      id: 1,
      supplierName: "Supp 10",
      entryDate: "2026-06-18T22:00:00Z",
      invoiceNumber: "123",
      total: 1000,
      canDelete: true,
      items: [],
    },
    isLoading: false,
  })),
  useReceivePurchaseEntry: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useDeletePurchaseEntry: vi.fn(() => ({
    mutate: vi.fn(),
  })),
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

describe("useStockEntries Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.selectedEntryId).toBeNull();
    expect(result.current.detailsModalOpen).toBe(false);
    expect(result.current.newEntryModalOpen).toBe(false);
    expect(result.current.supplierId).toBe("");
    expect(result.current.invoiceNumber).toBe("");
  });

  it("should handle handleAddEmptyItem and handleRemoveItem correctly", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleAddEmptyItem();
    });
    expect(result.current.items).toEqual([{ productId: "", quantity: 1, unitCost: 0, price: 0 }]);

    act(() => {
      result.current.handleRemoveItem(0);
    });
    expect(result.current.items).toEqual([]);
  });

  it("should reset form states correctly", () => {
    const { result } = renderHook(() => useStockEntries(), { wrapper: createWrapper() });

    act(() => {
      result.current.setSupplierId("10");
      result.current.setInvoiceNumber("Invoice-Test");
      result.current.resetNewEntryForm();
    });

    expect(result.current.supplierId).toBe("");
    expect(result.current.invoiceNumber).toBe("");
    expect(result.current.items).toEqual([]);
  });
});
