import { useMemo } from "react";
import { useGetStorefrontProductsInfinite } from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import type { CatalogFilters } from "@/routes";
import type { CatalogProduct } from "../types";
import { useCatalogFilters } from "./useCatalogFilters";
import { useDepartmentTree, type DepartmentTreeState } from "./useDepartmentTree";

/** Tamanho de página da vitrine: preenche a grade de 4 colunas sem sobra. */
export const CATALOG_PAGE_SIZE = 24;

export interface CatalogState {
  products: CatalogProduct[];
  /** Total de produtos que casam com a busca e o filtro atuais, dito pelo servidor. */
  totalCount: number;
  search: string;
  setSearch: (value: string) => void;
  /** Primeira carga (sem nada na tela ainda). */
  isLoading: boolean;
  /** A busca digitada ainda não virou requisição (debounce) ou está em voo. */
  isSearching: boolean;
  isError: boolean;
  errorMessage: string;
  /** Catálogo vazio SEM busca e SEM filtro — a loja não marcou produtos para o site. */
  isEmpty: boolean;
  /** A busca não encontrou nada (sem filtro ligado). */
  isSearchEmpty: boolean;
  /** O filtro não encontrou nada — o único estado com saída de emergência. */
  isFilterEmpty: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  /** Filtros em vigor, lidos da URL. */
  filters: CatalogFilters;
  hasFilters: boolean;
  /** Departamentos e categorias para a lista de filtros. */
  tree: DepartmentTreeState;
}

/**
 * Estado da vitrine: filtro por departamento/categoria, busca com debounce e
 * scroll infinito.
 *
 * A busca e os filtros vão ao SERVIDOR, diferente do site antigo que filtrava
 * no cliente — lá o catálogo inteiro era baixado de uma vez; aqui só as páginas
 * que o visitante rolou, então o cliente não tem o universo completo para
 * filtrar. O unaccent fica por conta do backend.
 *
 * É este hook que a página consome inteiro: filtro, árvore e grade saem daqui
 * já combinados, e a página só desenha (regra do CLAUDE.md §4).
 */
export function useCatalog(): CatalogState {
  const { filters, searchInput, setSearchInput, isSearchPending, hasFilters } = useCatalogFilters();

  const tree = useDepartmentTree(filters);

  const query = useGetStorefrontProductsInfinite({
    search: filters.search,
    departmentId: filters.departmentId,
    categoryId: filters.categoryId,
    size: CATALOG_PAGE_SIZE,
  });

  const products = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const totalCount = query.data?.pages[0]?.total ?? 0;
  const hasActiveSearch = Boolean(filters.search);
  const hasTaxonomyFilter = filters.departmentId !== undefined || filters.categoryId !== undefined;
  const isSettled = !query.isLoading && !query.isError && products.length === 0;

  return {
    products,
    totalCount,
    search: searchInput,
    setSearch: setSearchInput,
    isLoading: query.isLoading,
    isSearching: searchInput.trim().length > 0 && (isSearchPending || query.isFetching),
    isError: query.isError,
    errorMessage: query.error ? describeApiError(query.error) : "",
    // Os três vazios são excludentes e a ordem importa: com filtro ligado, a
    // mensagem tem que oferecer o botão de limpar. "Não achamos nada" sem saída
    // é beco sem saída — no celular a lista de filtros está fechada, e o
    // visitante nem vê o que está ligado.
    isEmpty: isSettled && !hasActiveSearch && !hasTaxonomyFilter,
    isSearchEmpty: isSettled && hasActiveSearch && !hasTaxonomyFilter,
    isFilterEmpty: isSettled && hasTaxonomyFilter,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
    filters,
    hasFilters,
    tree,
  };
}
