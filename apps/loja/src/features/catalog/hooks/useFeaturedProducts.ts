import { useGetStorefrontCompany, useGetStorefrontProducts } from "@workspace/api-client-react";
import { useIsMobile } from "@workspace/ui";
import type { CatalogProduct } from "../types";

/**
 * Quantos produtos a seção "Novidades" da home mostra quando a loja não
 * configurou nada. Era 8 fixo; desde 05/09/2026 o dono configura em
 * Admin > Configurações, e o valor gravado ganha deste padrão.
 *
 * DIVERGE de propósito do padrão do backend (`DefaultSiteNewProductsCount`,
 * ainda 20): em 06/09/2026 o dono pediu 12 na home e escolheu ajustar o valor
 * pelo admin em vez de mexer no backend. Este padrão só entra em cena quando a
 * API não manda o campo — hoje é o caso da API de produção, uma build anterior
 * à configuração. Se um dia o backend passar a 12 também, some com este
 * comentário, não com o número.
 */
export const DEFAULT_FEATURED_COUNT = 12;

/**
 * Teto da seção no celular em pé, independente do que estiver configurado.
 *
 * A grade tem duas colunas abaixo de `lg`, então 12 cards viram seis linhas —
 * o visitante rola a home inteira dentro de uma seção que é só a vitrina de
 * entrada. Com 8 são quatro linhas, e o rodapé volta a existir. O corte não é
 * visual: no celular a requisição já pede 8, então as outras fotos nem são
 * baixadas.
 */
export const MOBILE_FEATURED_COUNT = 8;

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
 *
 * O `total` da resposta é deliberadamente descartado: nenhuma tela pública diz
 * quantos produtos a loja tem (ver o README da feature). Devolver o número
 * aqui é o convite para alguém voltar a imprimi-lo.
 */
export function useFeaturedProducts(): FeaturedProductsState {
  // A quantidade vem da identidade da loja, que o rodapé já pede em toda
  // página — não há ida a mais. Enquanto ela não chega vale o padrão; se a
  // loja configurou outro número, a lista é refeita com ele.
  const company = useGetStorefrontCompany();
  const configured = resolveFeaturedCount(company.data?.newProductsCount);

  // O teto do celular é `min`, não substituição: quem configurou 5 continua
  // com 5: o limite existe para encurtar a rolagem, não para inventar cards
  // que a loja não quis mostrar. `useIsMobile` acerta já no primeiro render
  // (useSyncExternalStore lendo `innerWidth`), então não há requisição de 12
  // seguida de outra de 8 ao abrir no celular.
  const isMobile = useIsMobile();
  const count = isMobile ? Math.min(configured, MOBILE_FEATURED_COUNT) : configured;

  const query = useGetStorefrontProducts({ page: 1, size: count });

  const products = query.data?.data ?? [];

  return {
    products,
    isLoading: query.isLoading,
    isEmpty: !query.isLoading && (query.isError || products.length === 0),
  };
}
