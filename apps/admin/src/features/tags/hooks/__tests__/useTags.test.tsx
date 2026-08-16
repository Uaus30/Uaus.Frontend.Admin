import { renderHook, act } from "@testing-library/react";
import { useTags } from "../useTags";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getGetTagsQueryKey } from "@workspace/api-client-react";

/**
 * Dublê do api-client, só do que fala com a rede. A chave de cache vem do
 * módulo real: redefini-la no mock faria o teste de invalidação validar a chave
 * inventada aqui em vez da que a tela registra.
 */
const mocks = vi.hoisted(() => ({
  useGetTags: vi.fn(),
  createTag: vi.fn(() => Promise.resolve({ id: 11 })),
  updateTag: vi.fn(() => Promise.resolve({ id: 10 })),
  deleteTag: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetTags: mocks.useGetTags,
  useCreateTag: () => ({ mutateAsync: mocks.createTag, isPending: false }),
  useUpdateTag: () => ({ mutateAsync: mocks.updateTag, isPending: false }),
  useDeleteTag: () => ({ mutateAsync: mocks.deleteTag, isPending: false }),
}));

vi.mock("@/services/reports.service", () => ({
  getTagReport: vi.fn(() => Promise.resolve(null)),
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

const TAG_10 = {
  id: 10,
  name: "Tag 10",
  color: "#ff0000",
  isPublic: true,
  createdAt: "2026-06-18T22:00:00Z",
  updatedAt: null,
  productCount: 0,
};

describe("useTags Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTags.mockReturnValue({
      data: { data: [TAG_10], total: 1, page: 1, limit: 20 },
      isLoading: false,
    });
  });

  it("should initialize with default states", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTags(), { wrapper });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.sortBy).toBe("createdAt");
    expect(result.current.sortDir).toBe("desc");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.saving).toBe(false);
  });

  it("should handle openModal in create mode", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTags(), { wrapper });

    act(() => {
      result.current.openModal();
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.formData.name).toBe("");
    expect(result.current.formData.isPublic).toBe(false);
  });

  it("should handle openModal in edit mode", () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTags(), { wrapper });

    act(() => {
      result.current.openModal(TAG_10);
    });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(10);
    expect(result.current.formData.name).toBe("Tag 10");
    expect(result.current.formData.color).toBe("#ff0000");
    expect(result.current.formData.isPublic).toBe(true);
  });

  it("cria a etiqueta e invalida o PREFIXO do recurso", async () => {
    // Sob `["tags"]` estão a tabela desta tela E a busca do autocomplete do
    // editor de produtos. Invalidar a página aberta deixava a etiqueta nova
    // fora do autocomplete até um F5.
    const { queryClient, wrapper } = createWrapper();
    const buscaDoAutocomplete = [...getGetTagsQueryKey(), "search", "prom"];
    queryClient.setQueryData(buscaDoAutocomplete, { data: [] });

    const { result } = renderHook(() => useTags(), { wrapper });

    act(() => {
      result.current.setFormData({ name: "  Promoção  ", color: "#00ff00", isPublic: true });
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mocks.createTag).toHaveBeenCalledWith({
      data: { name: "Promoção", color: "#00ff00", isPublic: true },
    });
    expect(queryClient.getQueryState(buscaDoAutocomplete)?.isInvalidated).toBe(true);
  });

  it("na edição manda o id separado do corpo", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTags(), { wrapper });

    act(() => {
      result.current.openModal(TAG_10);
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(mocks.updateTag).toHaveBeenCalledWith({
      id: 10,
      data: { name: "Tag 10", color: "#ff0000", isPublic: true },
    });
  });

  it("remove a etiqueta e invalida o prefixo", async () => {
    const { queryClient, wrapper } = createWrapper();
    const pagina = [...getGetTagsQueryKey(), { search: "", page: 1, limit: 20 }];
    queryClient.setQueryData(pagina, { data: [] });

    const { result } = renderHook(() => useTags(), { wrapper });

    await act(async () => {
      await result.current.handleDelete(10);
    });

    expect(mocks.deleteTag).toHaveBeenCalledWith({ id: 10 });
    expect(queryClient.getQueryState(pagina)?.isInvalidated).toBe(true);
  });
});
