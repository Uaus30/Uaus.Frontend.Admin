import { useMemo, useState } from "react";
import { useGetStorefrontProductsInfinite } from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { useDebounce } from "@workspace/ui";
import type { CatalogProduct } from "../types";

/** Tamanho de página da vitrine: preenche a grade de 4 colunas sem sobra. */
export const CATALOG_PAGE_SIZE = 24;

export interface CatalogState {
  products: CatalogProduct[];
  /** Total de produtos que casam com a busca atual, informado pelo servidor. */
  totalCount: number;
  search: string;
  setSearch: (value: string) => void;
  /** Primeira carga (sem nada na tela ainda). */
  isLoading: boolean;
  /** A busca digitada ainda não virou requisição (debounce) ou está em voo. */
  isSearching: boolean;
  isError: boolean;
  errorMessage: string;
  /** Catálogo vazio SEM busca — a loja ainda não marcou produtos para o site. */
  isEmpty: boolean;
  /** A busca não encontrou nada. */
  isSearchEmpty: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * Estado da vitrine: busca com debounce + scroll infinito.
 *
 * A busca vai ao SERVIDOR (com o debounce padrão do repositório), diferente do
 * site antigo que filtrava no cliente — lá o catálogo inteiro era baixado de
 * uma vez; aqui só as páginas que o visitante rolou, então o cliente não tem o
 * universo completo para filtrar. O unaccent fica por conta do backend, que já
 * normaliza busca nos demais endpoints.
 */
export function useCatalog(): CatalogState {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const normalizedSearch = debouncedSearch.trim() || undefined;

  const query = useGetStorefrontProductsInfinite({ search: normalizedSearch, size: CATALOG_PAGE_SIZE });

  const products = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data]);

  const totalCount = query.data?.pages[0]?.total ?? 0;
  const hasActiveSearch = search.trim().length > 0;

  return {
    products,
    totalCount,
    search,
    setSearch,
    isLoading: query.isLoading,
    isSearching: hasActiveSearch && (search.trim() !== debouncedSearch.trim() || query.isFetching),
    isError: query.isError,
    errorMessage: query.error ? describeApiError(query.error) : "",
    isEmpty: !query.isLoading && !query.isError && products.length === 0 && !hasActiveSearch,
    isSearchEmpty: !query.isLoading && !query.isError && products.length === 0 && hasActiveSearch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  };
}
