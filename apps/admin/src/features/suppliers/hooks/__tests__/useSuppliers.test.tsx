import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSuppliers } from "../useSuppliers";

// Mock dos serviços de fornecedores e do núcleo
const mockCreateSupplier = vi.fn();
const mockUpdateSupplier = vi.fn();
const mockDeleteSupplier = vi.fn();
const mockGetSuppliersPage = vi.fn(() => Promise.resolve({
  data: [
    { id: 10, name: "Supplier A", minimumPurchaseValue: 100, status: 1, avatarColor: "#6366f1" }
  ],
  total: 1,
  page: 1,
  limit: 20,
}));

vi.mock("@/services/suppliers.service", () => ({
  getSuppliersPage: () => mockGetSuppliersPage(),
  createSupplier: (payload: any) => mockCreateSupplier(payload),
  updateSupplier: (payload: any) => mockUpdateSupplier(payload),
  deleteSupplier: (id: number) => mockDeleteSupplier(id),
}));

vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([
    { id: 1, name: "Ativo", value: "ativo", allowSelect: true },
    { id: 2, name: "Inativo", value: "inativo", allowSelect: true },
  ])),
}));

// Mock do toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
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

describe("useSuppliers Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(20);
    expect(result.current.searchVal).toBe("");
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("deve abrir a modal em modo de criação", () => {
    const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

    act(() => {
      result.current.handleOpenModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.form.name).toBe("");
  });

  it("deve abrir a modal em modo de edição e carregar os dados corretos", () => {
    const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

    const supplierToEdit = {
      id: 10,
      name: "Supplier A",
      minimumPurchaseValue: 100,
      status: 1,
      avatarColor: "#6366f1",
    };

    act(() => {
      result.current.handleOpenModal(supplierToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.form.name).toBe("Supplier A");
    expect(result.current.form.minimumPurchaseValue).toBe("100");
  });

  it("deve chamar createSupplier ao submeter formulário no modo de criação", async () => {
    const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

    const newSupplier = {
      name: "Supplier B",
      corporateName: "Supplier Corp",
      document: "123",
      salesRepresentative: "John Doe",
      phone: "11999999999",
      email: "b@test.com",
      minimumPurchaseValue: "150",
      status: "1",
      city: "Curitiba",
      state: "PR",
      avatarColor: "#6366f1",
      description: "Test description",
    };

    await act(async () => {
      await result.current.handleSubmitSupplier(newSupplier);
    });

    expect(mockCreateSupplier).toHaveBeenCalledWith({
      name: "Supplier B",
      corporateName: "Supplier Corp",
      document: "123",
      salesRepresentative: "John Doe",
      phone: "11999999999",
      email: "b@test.com",
      minimumPurchaseValue: 150,
      status: 1,
      city: "Curitiba",
      state: "PR",
      avatarColor: "#6366f1",
      description: "Test description",
    });
  });

  it("deve chamar deleteSupplier se a exclusão for confirmada", async () => {
    const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

    vi.spyOn(window, "confirm").mockImplementation(() => true);

    await act(async () => {
      await result.current.handleDeleteSupplier(10, "Supplier A");
    });

    expect(mockDeleteSupplier).toHaveBeenCalledWith(10);
  });
});
