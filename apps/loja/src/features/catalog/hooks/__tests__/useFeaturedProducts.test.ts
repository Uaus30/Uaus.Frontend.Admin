import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorefrontProductDto, UiPagedResult } from "@workspace/api-client-react";
import { FEATURED_COUNT, useFeaturedProducts } from "../useFeaturedProducts";

const mocks = vi.hoisted(() => ({
  useGetStorefrontProducts: vi.fn(),
}));

// Cerimônia do repositório: importOriginal + dublagem SÓ do que fala com a
// rede. Nada de redefinir chave de cache no mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorefrontProducts: mocks.useGetStorefrontProducts,
}));

function product(id: number): StorefrontProductDto {
  return {
    productGroupId: id,
    name: `Produto ${id}`,
    price: 10,
    hasVariations: false,
    categoryName: "Presentes",
    tags: [],
  };
}

function givenQueryReturns(overrides: {
  page?: UiPagedResult<StorefrontProductDto>;
  isLoading?: boolean;
  isError?: boolean;
}) {
  mocks.useGetStorefrontProducts.mockReturnValue({
    data: overrides.page,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  });
}

/**
 * O que estes testes protegem: a faixa de destaques é conteúdo acessório da
 * home. As duas propriedades que não podem regredir são (1) falha e catálogo
 * vazio produzirem o MESMO `isEmpty`, para a seção sumir em vez de mostrar
 * erro no meio da página inicial, e (2) o pedido continuar sendo de uma página
 * só — a home não pode baixar o catálogo inteiro.
 */
describe("useFeaturedProducts", () => {
  beforeEach(() => {
    mocks.useGetStorefrontProducts.mockReset();
  });

  it("pede uma página só, do tamanho da faixa", () => {
    givenQueryReturns({ page: { data: [], page: 1, limit: 8, total: 0, totalPages: 0 } });

    renderHook(() => useFeaturedProducts());

    expect(mocks.useGetStorefrontProducts).toHaveBeenCalledWith({ page: 1, size: FEATURED_COUNT });
  });

  it("entrega os produtos e o total do catálogo", () => {
    givenQueryReturns({
      page: { data: [product(1), product(2)], page: 1, limit: 8, total: 37, totalPages: 5 },
    });

    const { result } = renderHook(() => useFeaturedProducts());

    expect(result.current.products).toHaveLength(2);
    expect(result.current.totalCount).toBe(37);
    expect(result.current.isEmpty).toBe(false);
  });

  it("some quando o catálogo está vazio", () => {
    givenQueryReturns({ page: { data: [], page: 1, limit: 8, total: 0, totalPages: 0 } });

    const { result } = renderHook(() => useFeaturedProducts());

    expect(result.current.isEmpty).toBe(true);
  });

  it("some — em vez de mostrar erro — quando a chamada falha", () => {
    givenQueryReturns({ isError: true });

    const { result } = renderHook(() => useFeaturedProducts());

    expect(result.current.isEmpty).toBe(true);
    expect(result.current.products).toEqual([]);
  });

  it("não é considerado vazio enquanto carrega, para o esqueleto aparecer", () => {
    givenQueryReturns({ isLoading: true });

    const { result } = renderHook(() => useFeaturedProducts());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });
});
