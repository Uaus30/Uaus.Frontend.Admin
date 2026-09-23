import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import type { ProductTableRow } from "../../types";

const mocks = vi.hoisted(() => ({ setProductGroupShowOnSite: vi.fn(), toast: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  setProductGroupShowOnSite: mocks.setProductGroupShowOnSite,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useListFirstPhotoSitePrompt } = await import("../useListFirstPhotoSitePrompt");

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Object.assign(wrapper, { queryClient });
};

/** A linha como estava ANTES da foto da lupa. */
function linha(overrides: Partial<ProductTableRow> = {}, showOnSite = false): ProductTableRow {
  return {
    id: 987,
    productGroupId: 825,
    name: "COPO",
    productName: "COPO",
    description: null,
    barcode: "789",
    price: 9.9,
    costPrice: 5,
    stock: 3,
    minStock: 0,
    status: PRODUCT_STATUS.Active,
    variationCount: 1,
    variations: [],
    productGroup: { id: 825, name: "COPO", description: null, hasVariations: false, showOnSite, notes: null },
    category: { id: 5, name: "Utilidades" },
    department: { id: 2, name: "Casa" },
    tags: [],
    images: [],
    ...overrides,
  };
}

const umaFoto = [
  {
    associationId: 1,
    createdAt: "2026-09-01T00:00:00",
    updatedAt: null,
    imageId: 50,
    displayOrder: 0,
    image: { id: 50, name: "copo", url: "/img/copo.jpg" },
  },
];

describe("useListFirstPhotoSitePrompt — a primeira foto pela lupa da listagem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pergunta quando o cadastro não tinha foto e está fora do site", () => {
    const { result } = renderHook(() => useListFirstPhotoSitePrompt(), { wrapper: createWrapper() });

    act(() => result.current.offerFor(linha()));

    expect(result.current.open).toBe(true);
  });

  it("não pergunta a quem já tinha foto, nem a quem já está no site", () => {
    const { result } = renderHook(() => useListFirstPhotoSitePrompt(), { wrapper: createWrapper() });

    act(() => result.current.offerFor(linha({ images: umaFoto })));
    act(() => result.current.offerFor(linha({}, true)));

    expect(result.current.open).toBe(false);
  });

  it("o sim liga só o Exibir no site, na hora, e recarrega a listagem", async () => {
    mocks.setProductGroupShowOnSite.mockResolvedValue(undefined);
    const wrapper = createWrapper();
    const invalidate = vi.spyOn(wrapper.queryClient, "invalidateQueries");
    const { result } = renderHook(() => useListFirstPhotoSitePrompt(), { wrapper });

    act(() => result.current.offerFor(linha()));
    act(() => result.current.publish());

    await waitFor(() => expect(result.current.open).toBe(false));
    expect(mocks.setProductGroupShowOnSite).toHaveBeenCalledWith(825, true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: RESOURCE_KEYS.products });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Produto publicado no site" }));
  });

  it("agora não fecha sem gravar nada", () => {
    const { result } = renderHook(() => useListFirstPhotoSitePrompt(), { wrapper: createWrapper() });

    act(() => result.current.offerFor(linha()));
    act(() => result.current.dismiss());

    expect(result.current.open).toBe(false);
    expect(mocks.setProductGroupShowOnSite).not.toHaveBeenCalled();
  });
});
