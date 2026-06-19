import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCustomers } from "../useCustomers";

// Mock das dependências externas
vi.mock("@/services/sales.service", () => ({
  getAllSales: vi.fn(() => Promise.resolve([
    { id: 101, customerId: 1, total: 150 },
    { id: 102, customerId: 1, total: 50 },
  ])),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock do QueryClient e Mutações do API Client
const mockCreateCustomer = vi.fn();
const mockUpdateCustomer = vi.fn();
const mockDeleteCustomer = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  getGetCustomersQueryKey: () => ["customers"],
  useGetCustomers: vi.fn(() => ({
    data: {
      data: [
        { id: 1, name: "Maria Silva", email: "maria@test.com", phone: "11999999999", document: "123.456.789-00", address: "Rua A, 123", createdAt: "2026-06-18" }
      ],
      total: 1,
      page: 1,
      limit: 15,
    },
    isLoading: false,
  })),
  useCreateCustomer: vi.fn(() => ({
    mutate: mockCreateCustomer,
    isPending: false,
  })),
  useUpdateCustomer: vi.fn(() => ({
    mutate: mockUpdateCustomer,
    isPending: false,
  })),
  useDeleteCustomer: vi.fn(() => ({
    mutate: mockDeleteCustomer,
    isPending: false,
  })),
}));

// Wrapper de testes para prover o QueryClient
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

describe("useCustomers Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.searchVal).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.isSaving).toBe(false);
  });

  it("deve gerenciar a abertura da modal em modo de criação", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleOpenModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
  });

  it("deve gerenciar a abertura da modal em modo de edição", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    const customerToEdit = {
      id: 1,
      name: "Maria Silva",
      email: "maria@test.com",
      phone: "11999999999",
      document: "123.456.789-00",
      address: "Rua A, 123",
    };

    act(() => {
      result.current.handleOpenModal(customerToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.formData.name).toBe("Maria Silva");
    expect(result.current.formData.email).toBe("maria@test.com");
  });

  it("deve chamar a mutação correspondente ao salvar um cliente", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

    const payload = {
      name: "João Santos",
      email: "joao@test.com",
      phone: "11988888888",
      document: "111.222.333-44",
      address: "Rua B, 456",
    };

    act(() => {
      result.current.handleSaveCustomer(payload);
    });

    expect(mockCreateCustomer).toHaveBeenCalledWith({ data: payload });
  });

  it("deve chamar a mutação de exclusão de cliente se confirmado", () => {
    const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });
    
    vi.spyOn(window, "confirm").mockImplementation(() => true);

    act(() => {
      result.current.handleDeleteCustomer(1);
    });

    expect(mockDeleteCustomer).toHaveBeenCalledWith({ id: 1 });
  });
});
