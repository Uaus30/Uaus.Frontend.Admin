import { useGetStorefrontCompany, useGetStorefrontProducts } from "@workspace/api-client-react";
import type { CatalogProduct } from "../types";

/**
 * Quantos produtos a seção "Novidades" da home mostra quando a loja não
 * configurou nada — o MESMO padrão do backend (`site_new_products_count`).
 * Era 8 fixo; desde 05/09/2026 o dono configura em Admin > Configurações.
 */
export const DEFAULT_FEATURED_COUNT = 20;

/** Teto da vitrine (MaxPageSize do backend): acima disso o endpoint cortaria calado. */
const MAX_FEATURED_COUNT = 100;

/** Quantidade configurada saneada; lixo ou ausência caem no padrão. */
export function resolveFeaturedCount(configured: number | null | undefined): number {
  if (configured == null || !Number.isFinite(configured)) return DEFAULT_FEATURED_COUNT;
  const inteiro = Math.trunc(configured);
  if (inteiro < 1) return DEFAULT_FEATURED_COUNT;
  return Math.min(inteiro, MAX_FEATURED_COUNT);
}

export interface FeaturedProductsState {
  products: CatalogProduct[];
  /** Total do catálogo, para o link "ver todos" dizer quantos são. */
  totalCount: number;
  /** Quantos produtos a seção pede — o configurado no admin, ou o padrão. */
  count: number;
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
  // A quantidade vem da identidade da loja, que o rodapé já pede em toda
  // página — não há ida a mais. Enquanto ela não chega vale o padrão; se a
  // loja configurou outro número, a lista é refeita com ele.
  const company = useGetStorefrontCompany();
  const count = resolveFeaturedCount(company.data?.newProductsCount);
  const query = useGetStorefrontProducts({ page: 1, size: count });

  const products = query.data?.data ?? [];

  return {
    products,
    totalCount: query.data?.total ?? 0,
    count,
    isLoading: query.isLoading,
    isEmpty: !query.isLoading && (query.isError || products.length === 0),
  };
}
