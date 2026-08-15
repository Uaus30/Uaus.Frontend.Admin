import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSuppliers } from "../useSuppliers";

// Mock dos serviços de fornecedores e do núcleo
const mockCreateSupplier = vi.fn();
const mockUpdateSupplier = vi.fn();
const mockDeleteSupplier = vi.fn();
const mockGetSuppliersPage = vi.fn((..._params: unknown[]) => Promise.resolve({
  data: [
    { id: 10, name: "Supplier A", minimumPurchaseValue: 100, status: 1, avatarColor: "#6366f1" }
  ],
  total: 1,
  page: 1,
  limit: 20,
}));

vi.mock("@/services/suppliers.service", () => ({
  // Recebe os params para o teste poder afirmar o que foi ao servidor.
  getSuppliersPage: (params: unknown) => mockGetSuppliersPage(params),
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
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
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

  describe("filtro por status", () => {
    it("envia o status ao SERVIDOR, atravessando todas as páginas", async () => {
      // REGRESSÃO: o filtro era aplicado depois, sobre a página já recortada.
      // Numa base de 200 fornecedores, filtrar por "Inativo" mostrava só os
      // inativos que por acaso caíram nos 20 da página corrente — e o contador
      // de páginas continuava contando todos, produzindo páginas vazias.
      const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.setStatusFilter("2");
      });

      await vi.waitFor(() => {
        expect(mockGetSuppliersPage).toHaveBeenCalledWith(
          expect.objectContaining({ status: 2 }),
        );
      });
    });

    it('não envia status quando o filtro é "all"', async () => {
      const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

      await vi.waitFor(() => expect(mockGetSuppliersPage).toHaveBeenCalled());

      expect(result.current.statusFilter).toBe("all");
      expect(mockGetSuppliersPage).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });

    it("volta para a primeira página ao trocar o filtro", async () => {
      // A página 3 do conjunto anterior pode nem existir no novo.
      const { result } = renderHook(() => useSuppliers(), { wrapper: createWrapper() });

      await act(async () => {
        result.current.setPage(3);
      });
      expect(result.current.page).toBe(3);

      await act(async () => {
        result.current.setStatusFilter("2");
      });

      await vi.waitFor(() => expect(result.current.page).toBe(1));
    });
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
