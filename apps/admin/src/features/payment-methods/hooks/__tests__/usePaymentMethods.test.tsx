import { renderHook, act } from "@testing-library/react";
import { usePaymentMethods } from "../usePaymentMethods";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock api client react hooks
vi.mock("@workspace/api-client-react", () => ({
  useGetPaymentMethods: vi.fn(() => ({
    data: {
      data: [
        {
          id: 1,
          name: "Dinheiro",
          isActive: true,
          installments: [{ id: 10, paymentMethodId: 1, installmentNumber: 1, feePercentage: 0, isActive: true }]
        }
      ],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1
    },
    isLoading: false,
    refetch: vi.fn()
  })),
  useCreatePaymentMethod: vi.fn(() => ({
    mutateAsync: vi.fn(() => Promise.resolve({ id: 2 })),
    isPending: false
  })),
  useUpdatePaymentMethod: vi.fn(() => ({
    mutateAsync: vi.fn(() => Promise.resolve({ id: 1 })),
    isPending: false
  })),
  useDeletePaymentMethod: vi.fn(() => ({
    mutateAsync: vi.fn(() => Promise.resolve()),
    isPending: false
  })),
  getGetPaymentMethodsQueryKey: () => ["PaymentMethods"]
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("usePaymentMethods Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com valores padrão e listar formas de pagamento", () => {
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.isActiveFilter).toBe("all");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].name).toBe("Dinheiro");
  });

  it("deve abrir modal no modo criação com 1x a vista padrão (0% de taxa)", () => {
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

    act(() => {
      result.current.openCreateModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
    expect(result.current.formData.installments).toHaveLength(1);
    expect(result.current.formData.installments[0].installmentNumber).toBe(1);
    expect(result.current.formData.installments[0].feePercentage).toBe(0);
  });

  it("deve permitir adicionar novo parcelamento", () => {
    const { result } = renderHook(() => usePaymentMethods(), { wrapper: createWrapper() });

    act(() => {
      result.current.openCreateModal();
    });

    act(() => {
      result.current.handleAddInstallment();
    });

    expect(result.current.formData.installments).toHaveLength(2);
    expect(result.current.formData.installments[1].installmentNumber).toBe(2);
  });
});
