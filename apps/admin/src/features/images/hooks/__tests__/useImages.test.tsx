import { renderHook, act, waitFor } from "@testing-library/react";
import { useImages } from "../useImages";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the services
vi.mock("@/services/core", () => ({
  buildPublicImageUrl: vi.fn((url) => `http://public-url${url}`),
  getEnumOptions: vi.fn(() =>
    Promise.resolve([{ id: 1, name: "Produto", value: "Product", allowSelect: true }]),
  ),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(() => Promise.resolve({ id: 11 })),
  deleteImage: vi.fn(() => Promise.resolve()),
  getImagesPage: vi.fn(() =>
    Promise.resolve({
      data: [{ id: 10, name: "Img 10", url: "/img10.png", type: 1, createdAt: "2026-06-18T22:00:00Z" }],
      total: 1,
      page: 1,
      limit: 20,
    }),
  ),
  // Catálogo completo: 3 imagens tipo 1 e 2 imagens tipo 2, como se estivessem
  // espalhadas por várias páginas do servidor.
  getAllImages: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: "Prod 1", url: "/p1.png", type: 1, createdAt: "2026-06-18T22:00:00Z" },
      { id: 2, name: "Banner 1", url: "/b1.png", type: 2, createdAt: "2026-06-18T22:00:00Z" },
      { id: 3, name: "Prod 2", url: "/p2.png", type: 1, createdAt: "2026-06-18T22:00:00Z" },
      { id: 4, name: "Banner 2", url: "/b2.png", type: 2, createdAt: "2026-06-18T22:00:00Z" },
      { id: 5, name: "Prod 3", url: "/p3.png", type: 1, createdAt: "2026-06-18T22:00:00Z" },
    ]),
  ),
  updateImageRecord: vi.fn(() => Promise.resolve()),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
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

describe("useImages Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    expect(result.current.search).toBe("");
    expect(result.current.typeFilter).toBe("all");
    expect(result.current.page).toBe(1);
    expect(result.current.uploadOpen).toBe(false);
    expect(result.current.renameOpen).toBe(false);
    expect(result.current.uploading).toBe(false);
  });

  it("should reset upload form correctly", () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    act(() => {
      result.current.setFormName("Test Img");
      result.current.setFormType("1");
      result.current.resetUploadForm();
    });

    expect(result.current.formName).toBe("");
    expect(result.current.file).toBeNull();
    expect(result.current.preview).toBeNull();
  });

  it("should handle handleRenameOpen correctly", () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    const imageToRename = {
      id: 10,
      name: "Img 10",
      url: "/img10.png",
      type: 1,
      createdAt: "2026-06-18T22:00:00Z",
    };

    act(() => {
      result.current.handleRenameOpen(imageToRename);
    });

    expect(result.current.renameOpen).toBe(true);
    expect(result.current.renameImage).toEqual(imageToRename);
    expect(result.current.renameName).toBe("Img 10");
  });

  it("deve filtrar por tipo sobre o catálogo COMPLETO, com total e paginação honestos", async () => {
    // Regressão: o filtro de tipo era aplicado só sobre a página corrente do
    // servidor — a grade ficava vazia mesmo havendo imagens do tipo em outras
    // páginas, e o total/paginação continuavam os do conjunto sem filtro.
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    act(() => {
      result.current.setPage(3);
    });
    act(() => {
      result.current.setTypeFilter("2");
    });

    // Trocar o tipo volta para a primeira página
    expect(result.current.page).toBe(1);

    await waitFor(() => expect(result.current.filteredImages).toHaveLength(2));

    // Apenas as imagens do tipo selecionado, vindas do catálogo completo
    expect(result.current.filteredImages.map((item) => item.id)).toEqual([2, 4]);
    // Contagem e paginação refletem o recorte filtrado, não o total geral. O
    // total de páginas não é mais conferido aqui porque o hook parou de
    // calculá-lo: quem deriva é o `TablePagination`, a partir destes números.
    expect(result.current.imagePage?.total).toBe(2);
    expect(result.current.imagePage?.limit).toBe(20);
  });

  it("deve voltar à paginação do servidor ao limpar o filtro de tipo", async () => {
    const { result } = renderHook(() => useImages(), { wrapper: createWrapper() });

    act(() => {
      result.current.setTypeFilter("2");
    });
    await waitFor(() => expect(result.current.filteredImages).toHaveLength(2));

    act(() => {
      result.current.setTypeFilter("all");
    });

    await waitFor(() => expect(result.current.filteredImages).toHaveLength(1));
    expect(result.current.filteredImages[0].id).toBe(10);
    expect(result.current.imagePage?.total).toBe(1);
  });
});
