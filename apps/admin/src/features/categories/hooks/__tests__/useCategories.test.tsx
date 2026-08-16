import { renderHook, act } from "@testing-library/react";
import { useCategories } from "../useCategories";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetCategoriesQueryKey } from "@workspace/api-client-react";

/**
 * O hook não conhece mais caminho HTTP: ele fala com os hooks do api-client.
 * O dublê, portanto, é do api-client — e SÓ do que fala com a rede. A chave de
 * cache continua vindo do módulo real (`importOriginal`), senão o teste de
 * invalidação validaria uma chave inventada aqui em vez da que a tela usa.
 */
const mocks = vi.hoisted(() => ({
  useGetCategories: vi.fn(),
  createCategory: vi.fn(() => Promise.resolve(null)),
  updateCategory: vi.fn(() => Promise.resolve(null)),
  deleteCategory: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCategories: mocks.useGetCategories,
  useCreateCategory: () => ({ mutateAsync: mocks.createCategory, isPending: false }),
  useUpdateCategory: () => ({ mutateAsync: mocks.updateCategory, isPending: false }),
  useDeleteCategory: () => ({ mutateAsync: mocks.deleteCategory, isPending: false }),
}));

// O catálogo de departamentos ainda passa por `use-catalog`, que lê o serviço.
vi.mock("@/services/categories.service", () => ({
  getAllDepartments: vi.fn(() => Promise.resolve([{ id: 1, name: "Dep 1" }])),
  getAllCategories: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/reports.service", () => ({
  getCategoryReport: vi.fn(() => Promise.resolve(null)),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

/** Wrapper com o QueryClient REAL — o teste de invalidação depende do cache de verdade. */
function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** Evento de submit sem DOM: o hook só chama `preventDefault`. */
function submitEvent() {
  return { preventDefault: () => {} } as React.FormEvent;
}

describe("useCategories Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetCategories.mockReturnValue({
      data: {
        data: [{ id: 10, name: "Cat 10", departmentId: 1, description: "Desc 10", productCount: 4 }],
        total: 1,
        page: 1,
        limit: 20,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it("should initialize with default states", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.departmentFilter).toBe("all");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("should handle openModal in create mode", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
  });

  it("should handle openModal in edit mode", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper });

    const categoryToEdit = {
      id: 10,
      departmentId: 1,
      name: "Cat 10",
      description: "Desc 10",
      department: { id: 1, name: "Dep 1" },
      productCount: 4,
      // Campos de auditoria do DTO. Faltavam no fixture porque o tipo local era
      // escrito à mão e não os declarava — o mesmo descolamento que produzia o
      // `map((category: any))` no hook.
      createdAt: "2026-08-01T10:00:00",
      updatedAt: null,
    };

    act(() => {
      result.current.openModal(categoryToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.formData.name).toBe("Cat 10");
    expect(result.current.formData.description).toBe("Desc 10");
  });

  it("filtra por departamento no SERVIDOR, e não sobre a página já recortada", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper });

    act(() => {
      result.current.setDepartmentFilter("7");
    });

    expect(mocks.useGetCategories).toHaveBeenLastCalledWith(expect.objectContaining({ departmentId: 7 }));
  });

  it("cria a categoria e invalida o PREFIXO do recurso, não só a página aberta", async () => {
    // REGRESSÃO da armadilha nº 1 do CLAUDE.md: invalidar a combinação exata de
    // parâmetros da tela deixa as outras páginas e buscas com o dado velho, e
    // isso não gera erro nenhum — a listagem só não atualiza.
    const { queryClient, wrapper } = createWrapper();
    const outraPagina = [...getGetCategoriesQueryKey(), { search: "bermuda", page: 3, limit: 20 }];
    queryClient.setQueryData(outraPagina, { data: [], total: 0, page: 3, limit: 20 });

    const { result } = renderHook(() => useCategories(), { wrapper });

    act(() => {
      result.current.setFormData({ departmentId: "1", name: "  Bermudas  ", description: "" });
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mocks.createCategory).toHaveBeenCalledWith({
      data: { departmentId: 1, name: "Bermudas", description: null },
    });
    expect(queryClient.getQueryState(outraPagina)?.isInvalidated).toBe(true);
  });

  it("na edição manda o id separado do corpo, como o PUT do backend espera", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCategories(), { wrapper });

    act(() => {
      result.current.openModal({
        id: 10,
        departmentId: 1,
        name: "Cat 10",
        description: "Desc 10",
        department: { id: 1, name: "Dep 1" },
        productCount: 4,
        createdAt: "2026-08-01T10:00:00",
        updatedAt: null,
      });
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mocks.updateCategory).toHaveBeenCalledWith({
      id: 10,
      data: { departmentId: 1, name: "Cat 10", description: "Desc 10" },
    });
  });

  it("remove a categoria e invalida o prefixo", async () => {
    const { queryClient, wrapper } = createWrapper();
    const pagina = [...getGetCategoriesQueryKey(), { search: "", page: 1, limit: 20 }];
    queryClient.setQueryData(pagina, { data: [], total: 0, page: 1, limit: 20 });

    const { result } = renderHook(() => useCategories(), { wrapper });

    await act(async () => {
      await result.current.handleDelete(10);
    });

    expect(mocks.deleteCategory).toHaveBeenCalledWith({ id: 10 });
    expect(queryClient.getQueryState(pagina)?.isInvalidated).toBe(true);
  });
});
