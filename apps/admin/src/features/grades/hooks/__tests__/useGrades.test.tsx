import { renderHook, act } from "@testing-library/react";
import { useGrades } from "../useGrades";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetGradesQueryKey } from "@workspace/api-client-react";

/**
 * Dublê do api-client, só do que fala com a rede. A chave de cache vem do
 * módulo real.
 */
const mocks = vi.hoisted(() => ({
  createGrade: vi.fn(() => Promise.resolve({ id: 11 })),
  updateGrade: vi.fn(() => Promise.resolve({ id: 1 })),
  deleteGrade: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetGrades: () => ({
    data: [
      {
        id: 1,
        name: "Grade Tamanho",
        type: 1,
        categoryIds: [101],
        options: [{ id: 1, gradeId: 1, value: "P", colorHex: null, displayOrder: 0 }],
      },
    ],
    isLoading: false,
  }),
  useGetGradeTypeOptions: () => ({
    data: [
      { id: 1, name: "Tamanho", value: "Size", allowSelect: true },
      { id: 2, name: "Cor", value: "Color", allowSelect: true },
    ],
  }),
  useCreateGrade: () => ({ mutateAsync: mocks.createGrade, isPending: false }),
  useUpdateGrade: () => ({ mutateAsync: mocks.updateGrade, isPending: false }),
  useDeleteGrade: () => ({ mutateAsync: mocks.deleteGrade, isPending: false }),
}));

// Categorias e departamentos ainda passam por `use-catalog`, que lê o serviço.
vi.mock("@/services/categories.service", () => ({
  getAllCategories: vi.fn(() => Promise.resolve([{ id: 101, name: "Calçados", departmentId: 10 }])),
  getAllDepartments: vi.fn(() => Promise.resolve([{ id: 10, name: "Calçados Dept" }])),
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

function submitEvent() {
  return { preventDefault: () => {} } as React.FormEvent;
}

describe("useGrades Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGrades(), { wrapper });

    expect(result.current.search).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
    expect(result.current.gradeType).toBe("Tamanho");
  });

  it("should handle openModal in create mode", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGrades(), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.selectedCategoryIds).toEqual([]);
    expect(result.current.variants).toEqual([]);
  });

  it("should handle openModal in edit mode", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGrades(), { wrapper });

    const gradeToEdit = {
      id: 1,
      name: "Grade Tamanho",
      type: "Tamanho" as const,
      categoryIds: [101],
      variants: [{ id: 1, value: "P", order: 0 }],
    };

    act(() => {
      result.current.openModal(gradeToEdit);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(1);
    expect(result.current.selectedCategoryIds).toEqual([101]);
    expect(result.current.variants).toEqual([{ id: 1, value: "P", order: 0 }]);
  });

  it("salva a opção que ainda está na linha fantasma", async () => {
    // REGRESSÃO: `handleSubmit` chamava `commitGhostRow()` e logo depois lia
    // `variants`, que só é atualizado no render seguinte. Com a tabela vazia e a
    // linha fantasma preenchida, o formulário recusava com "adicione ao menos
    // uma opção" — a opção estava visível na tela.
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGrades(), { wrapper });

    act(() => {
      result.current.openModal();
    });
    act(() => {
      result.current.setSelectedCategoryIds([101]);
      result.current.setGhostValue("P");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mocks.createGrade).toHaveBeenCalledWith({
      data: {
        type: 1,
        categoryIds: [101],
        options: [{ value: "P", colorHex: null, displayOrder: 0 }],
      },
    });
  });

  it("na edição só reenvia o id da opção que já existia na grade", async () => {
    // Opção criada na sessão carrega id local (`Date.now()`); mandá-lo faria o
    // servidor tentar atualizar uma linha que não é dele.
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGrades(), { wrapper });

    act(() => {
      result.current.openModal({
        id: 1,
        name: "Grade Tamanho",
        type: "Tamanho",
        categoryIds: [101],
        variants: [{ id: 1, value: "P", order: 0 }],
      });
    });
    act(() => {
      result.current.setGhostValue("M");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mocks.updateGrade).toHaveBeenCalledWith({
      data: {
        id: 1,
        type: 1,
        categoryIds: [101],
        options: [
          { id: 1, value: "P", colorHex: null, displayOrder: 0 },
          { id: undefined, value: "M", colorHex: null, displayOrder: 1 },
        ],
      },
    });
  });

  it("remove a grade e invalida o prefixo do recurso", async () => {
    const { queryClient, wrapper } = createWrapper();
    const catalogoCompleto = [...getGetGradesQueryKey(), "all"];
    queryClient.setQueryData(catalogoCompleto, []);

    const { result } = renderHook(() => useGrades(), { wrapper });

    await act(async () => {
      await result.current.handleDelete(1);
    });

    expect(mocks.deleteGrade).toHaveBeenCalledWith({ id: 1 });
    expect(queryClient.getQueryState(catalogoCompleto)?.isInvalidated).toBe(true);
  });
});
