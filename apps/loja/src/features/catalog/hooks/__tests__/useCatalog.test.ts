import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import type {
  StorefrontDepartmentDto,
  StorefrontProductDto,
  UiPagedResult,
} from "@workspace/api-client-react";
import { useCatalog } from "../useCatalog";

const mocks = vi.hoisted(() => ({
  useGetStorefrontProductsInfinite: vi.fn(),
  useGetStorefrontDepartments: vi.fn(),
}));

// Cerimônia do repositório: importOriginal + dublagem SÓ do que fala com a
// rede. Nada de redefinir chave de cache no mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorefrontProductsInfinite: mocks.useGetStorefrontProductsInfinite,
  useGetStorefrontDepartments: mocks.useGetStorefrontDepartments,
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

function givenDepartmentsReturn(departments: StorefrontDepartmentDto[] = []) {
  mocks.useGetStorefrontDepartments.mockReturnValue({
    data: departments,
    isLoading: false,
    isError: false,
  });
}

/**
 * Cada teste com a própria URL em memória: o filtro mora na query string, e a
 * localização do jsdom é global — sem isolar, o `?busca=` de um teste
 * apareceria no seguinte.
 */
function renderCatalog(searchPath = "") {
  const { hook } = memoryLocation({ path: "/produtos", searchPath, record: true });
  const wrapper = ({ children }: { children: ReactNode }) => createElement(Router, { hook }, children);

  return renderHook(() => useCatalog(), { wrapper });
}

const NO_FILTER = { search: undefined, departmentId: undefined, categoryId: undefined, size: 24 };

describe("useCatalog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    givenDepartmentsReturn();
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

    const { result } = renderCatalog();

    expect(result.current.products.map((p) => p.productGroupId)).toEqual([2, 1, 3]);
  });

  it("só manda a busca ao servidor depois do debounce, e sem termo vazio", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });
    const { result, rerender } = renderCatalog();

    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith(NO_FILTER);

    act(() => result.current.setSearch("caneca"));
    rerender();
    // Antes do debounce vencer, o parâmetro ainda é o antigo.
    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith(NO_FILTER);

    act(() => vi.advanceTimersByTime(300));
    rerender();
    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith({
      ...NO_FILTER,
      search: "caneca",
    });

    // Só espaços não viram busca — o backend receberia um termo inútil.
    act(() => result.current.setSearch("   "));
    act(() => vi.advanceTimersByTime(300));
    rerender();
    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith(NO_FILTER);
  });

  it("manda a mesma busca para a grade e para a árvore de filtros", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });
    const { result, rerender } = renderCatalog();

    act(() => result.current.setSearch("caneca"));
    act(() => vi.advanceTimersByTime(300));
    rerender();

    // É o que sustenta a contagem da faceta: se a árvore recebesse outra busca
    // (ou nenhuma), "Cozinha (7)" apareceria ao lado de três cards. A leitura
    // sem busca também acontece — é o retrato do catálogo, de onde saem nomes e
    // existência dos filtros.
    expect(mocks.useGetStorefrontDepartments).toHaveBeenCalledWith("caneca");
  });

  it("lê o filtro da URL e o repassa para a consulta", () => {
    givenQueryReturns({ pages: [pageOf([product(1, "Panela")], 1, 1)] });

    const { result } = renderCatalog("departamento=2&categoria=10");

    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith({
      ...NO_FILTER,
      departmentId: 2,
      categoryId: 10,
    });
    expect(result.current.filters).toMatchObject({ departmentId: 2, categoryId: 10 });
  });

  it("ignora id de filtro inválido na URL em vez de quebrar a vitrine", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });

    const { result } = renderCatalog("departamento=abc&categoria=-3");

    expect(mocks.useGetStorefrontProductsInfinite).toHaveBeenLastCalledWith(NO_FILTER);
    expect(result.current.filters).toMatchObject({ departmentId: undefined, categoryId: undefined });
  });

  it("distingue catálogo vazio, busca sem resultado e filtro sem resultado", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });
    const { result, rerender } = renderCatalog();

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.isSearchEmpty).toBe(false);
    expect(result.current.isFilterEmpty).toBe(false);

    act(() => result.current.setSearch("inexistente"));
    act(() => vi.advanceTimersByTime(300));
    rerender();

    expect(result.current.isEmpty).toBe(false);
    expect(result.current.isSearchEmpty).toBe(true);
  });

  it("marca vazio de FILTRO, e não de busca — só ele oferece a saída de limpar", () => {
    givenQueryReturns({ pages: [pageOf([], 1, 0)] });

    const { result } = renderCatalog("categoria=10");

    expect(result.current.isFilterEmpty).toBe(true);
    expect(result.current.isSearchEmpty).toBe(false);
    expect(result.current.isEmpty).toBe(false);
  });

  it("expõe carregando e buscando como estados separados", () => {
    givenQueryReturns({ isLoading: true });
    const { result, rerender } = renderCatalog();

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
