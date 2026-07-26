import { renderHook, act, waitFor } from "@testing-library/react";
import { useSales } from "../useSales";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([
    { id: 1, name: "Pix", allowSelect: true },
  ])),
}));

vi.mock("@/services/mappers", () => ({
  buildProductCollections: vi.fn(() => ({ enrichedProducts: [{ id: 1, name: "Prod 1", price: 100, stock: 10 }] })),
  buildEnrichedSales: vi.fn(() => []),
}));

vi.mock("@/services/products.service", () => ({
  getAllProducts: vi.fn(() => Promise.resolve([])),
  getAllProductGroups: vi.fn(() => Promise.resolve([])),
  getAllProductTags: vi.fn(() => Promise.resolve([])),
  getAllProductImages: vi.fn(() => Promise.resolve([])),
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
}));

vi.mock("@/services/customers.service", () => ({
  getAllCustomers: vi.fn(() => Promise.resolve([{ id: 10, name: "Cust 10" }])),
}));

vi.mock("@/services/sales.service", () => ({
  getAllSaleItems: vi.fn(() => Promise.resolve([])),
  createSaleWithItems: vi.fn(() => Promise.resolve({ id: 99 })),
  deleteSaleWithItems: vi.fn(() => Promise.resolve()),
}));

// Mock api client react queries
vi.mock("@workspace/api-client-react", () => ({
  useGetSales: vi.fn(() => ({
    data: {
      data: [],
      total: 0,
      limit: 15,
      page: 1,
    },
    isLoading: false,
  })),
  useGetPaymentMethods: vi.fn(() => ({
    data: {
      data: [{ id: 1, name: "Pix", isActive: true, installments: [] }],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1
    },
    isLoading: false,
  })),
  getGetSalesQueryKey: () => ["sales-page"],
  PRODUCT_STATUS: { None: 0, Draft: 1, Active: 2, OutOfStock: 3, Inactive: 4 },
  enumCode: (value: unknown) => (typeof value === "number" ? value : 0),
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

describe("useSales Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.startDate).toBe("");
    expect(result.current.endDate).toBe("");
    expect(result.current.paymentMethodFilter).toBe("all");
    expect(result.current.paymentStatusFilter).toBe("all");
    expect(result.current.createModalOpen).toBe(false);
    expect(result.current.viewSaleId).toBeNull();
    expect(result.current.items).toEqual([]);
    expect(result.current.discount).toBe(0);
    expect(result.current.subtotal).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it("should handle cart modifications", async () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => {
      result.current.setCreateModalOpen(true);
    });

    // Wait for the async product collections query to load
    await waitFor(() => expect(result.current.availableProducts.length).toBeGreaterThan(0));

    act(() => {
      result.current.setSelectedProductId(1);
      result.current.setSelectedQty(2);
    });

    act(() => {
      result.current.addItem();
    });

    expect(result.current.items).toEqual([{ productId: 1, quantity: 2, unitPrice: 100 }]);
    expect(result.current.subtotal).toBe(200);

    act(() => {
      result.current.setDiscount(50);
    });
    expect(result.current.total).toBe(150);

    act(() => {
      result.current.removeItem(1);
    });
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("should keep a single payment in sync with the sale total", async () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => {
      result.current.setCreateModalOpen(true);
    });
    await waitFor(() => expect(result.current.availableProducts.length).toBeGreaterThan(0));

    act(() => {
      result.current.resetSaleForm();
    });
    await waitFor(() => expect(result.current.payments).toHaveLength(1));

    act(() => {
      result.current.setSelectedProductId(1);
      result.current.setSelectedQty(2);
    });
    act(() => {
      result.current.addItem();
    });

    await waitFor(() => expect(result.current.payments[0].amount).toBe(200));
    expect(result.current.remainingAmount).toBe(0);
  });

  it("should not let a lone payment drift away from the total", async () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => {
      result.current.setCreateModalOpen(true);
    });
    await waitFor(() => expect(result.current.availableProducts.length).toBeGreaterThan(0));

    act(() => {
      result.current.resetSaleForm();
    });
    await waitFor(() => expect(result.current.payments).toHaveLength(1));

    act(() => {
      result.current.setSelectedProductId(1);
      result.current.setSelectedQty(1);
    });
    act(() => {
      result.current.addItem();
    });
    await waitFor(() => expect(result.current.payments[0].amount).toBe(100));

    // Com uma única forma, o valor sempre volta a acompanhar o total da venda.
    act(() => {
      result.current.updatePayment(0, { amount: 60 });
    });
    await waitFor(() => expect(result.current.payments[0].amount).toBe(100));
    expect(result.current.remainingAmount).toBe(0);

    // O mock só tem uma forma de pagamento cadastrada, então não há o que dividir.
    act(() => {
      result.current.addPayment();
    });
    expect(result.current.payments).toHaveLength(1);
  });
});
