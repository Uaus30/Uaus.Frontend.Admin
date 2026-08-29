import { useGetStorefrontProducts } from "@workspace/api-client-react";
import type { CatalogProduct } from "../types";

/**
 * Quantos produtos a faixa da home mostra. Oito porque preenche duas linhas na
 * grade de quatro colunas e uma no desktop largo, sem virar uma segunda
 * vitrine — quem quer o catálogo inteiro clica em "Ver todos".
 */
export const FEATURED_COUNT = 8;

export interface FeaturedProductsState {
  products: CatalogProduct[];
  /** Total do catálogo, para o link "ver todos" dizer quantos são. */
  totalCount: number;
  isLoading: boolean;
  /**
   * Não há o que mostrar — catálogo vazio OU a chamada falhou. Nos dois casos
   * a seção inteira some da home.
   */
  isEmpty: boolean;
}

/**
 * Os primeiros produtos da vitrine, para a faixa de destaques da home.
 *
 * A home não mostrava um único produto: hero, faixa, carrossel e cartões, tudo
 * institucional. Loja cuja página inicial não tem produto parece catálogo
 * vazio, e o visitante precisava clicar em "Produtos" para descobrir que não
 * é.
 *
 * Falha vira seção ausente, não caixa de erro: destaque é conteúdo acessório —
 * o hero, o endereço e o WhatsApp continuam de pé, e um "não foi possível
 * carregar" no meio da home dá a impressão de site quebrado por algo que o
 * visitante nem sabia que existia.
 */
export function useFeaturedProducts(): FeaturedProductsState {
  const query = useGetStorefrontProducts({ page: 1, size: FEATURED_COUNT });

  const products = query.data?.data ?? [];

  return {
    products,
    totalCount: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isEmpty: !query.isLoading && (query.isError || products.length === 0),
  };
}
