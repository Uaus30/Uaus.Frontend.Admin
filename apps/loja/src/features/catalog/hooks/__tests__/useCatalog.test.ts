import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorefrontProductDto, UiPagedResult } from "@workspace/api-client-react";
import { useCatalog } from "../useCatalog";

const mocks = vi.hoisted(() => ({
  useGetStorefrontProductsInfinite: vi.fn(),
}));

// Cerimônia do repositório: importOriginal + dublagem SÓ do que fala com a
// rede. Nada de redefinir chave de cache no mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorefrontProductsInfinite: mocks.useGetStorefrontProductsInfinite,
}));

function product(id: number, name: string): StorefrontProductDto {
  return {
    productGroupId: id,
    name,
    price: 10,
    hasVariations: false,
    categoryName: "Presentes",
    tags: [],
  };
}

function pageOf(
  products: StorefrontProductDto[],
  page: number,
  total: number,
): UiPagedResult<StorefrontProductDto> {
  return { data: products, page, limit: 24, total, totalPages: Math.ceil(total / 24) };
}

interface QueryOverrides {
  pages?: UiPagedResult<StorefrontProductDto>[];
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
  hasNextPage?: boolean;
}

function givenQueryReturns(overrides: QueryOverrides = {}) {
  mocks.useGetStorefrontProductsInfinite.mockReturnValue({
    data: overrides.pages ? { pages: overrides.pages, pageParams: [] } : undefined,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    isFetching: overrides.isFetching ?? false,
    error: null,
    hasNextPage: overrides.hasNextPage ?? false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  });
}

describe("useCatalog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("achata as páginas do scroll infinito numa lista única, na ordem", () => {
    givenQueryReturns({
      pages: [
        pageOf([product(2, "Caderno"), product(1, "Caneca")], 1, 3),
        pageOf([product(3, "Bola")], 2, 3),
      ],
    });

    const { result } = renderHook(() => useCatalog());

    expect(result.current.products.map((p) => p.productGroupId)).toEqual([2, 1, 3]);
    expect(result.current.totalCount).toBe(3);
  });

  it("só manda a busca ao servidor depois do debounce, e sem termo vazio", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });
    const { result, rerender } = renderHook(() => useCatalog());

    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith({
      search: undefined,
      size: 24,
    });

    act(() => result.current.setSearch("caneca"));
    rerender();
    // Antes do debounce vencer, o parâmetro ainda é o antigo.
    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith({
      search: undefined,
      size: 24,
    });

    act(() => vi.advanceTimersByTime(300));
    rerender();
    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith({
      search: "caneca",
      size: 24,
    });

    // Só espaços não viram busca — o backend receberia um termo inútil.
    act(() => result.current.setSearch("   "));
    act(() => vi.advanceTimersByTime(300));
    rerender();
    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith({
      search: undefined,
      size: 24,
    });
  });

  it("distingue catálogo vazio de busca sem resultado — as mensagens da tela são outras", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });
    const { result, rerender } = renderHook(() => useCatalog());

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.isSearchEmpty).toBe(false);

    act(() => result.current.setSearch("inexistente"));
    act(() => vi.advanceTimersByTime(300));
    rerender();

    expect(result.current.isEmpty).toBe(false);
    expect(result.current.isSearchEmpty).toBe(true);
  });

  it("expõe carregando e buscando como estados separados", () => {
    givenQueryReturns({ isLoading: true });
    const { result, rerender } = renderHook(() => useCatalog());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isSearching).toBe(false);

    // Digitou agora: até o debounce vencer, `isSearching` já é true — é o
    // spinner do campo de busca, não o da página.
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });
    act(() => result.current.setSearch("caneca"));
    rerender();
    expect(result.current.isSearching).toBe(true);
  });
});
