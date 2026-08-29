import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Fonte única de rotas e navegação do site — o mesmo princípio do admin:
 * rota e menu nunca divergem porque o menu é derivado daqui.
 *
 * Sem papéis nem `publica`: TUDO no site é público e anônimo. Se um dia surgir
 * área restrita, ela não nasce aqui — nasce no admin, que já tem autorização.
 */
export interface SiteRoute {
  path: string;
  /** Presente = aparece na navegação do header/rodapé. */
  label?: string;
  component: LazyExoticComponent<ComponentType<Record<string, never>>>;
}

export const ROUTES: SiteRoute[] = [
  { path: "/", label: "Início", component: lazy(() => import("@/pages/home")) },
  { path: "/produtos", label: "Produtos", component: lazy(() => import("@/pages/products")) },
  { path: "/contato", label: "Contato", component: lazy(() => import("@/pages/contact")) },
];

/**
 * Detalhe do produto fica fora de `ROUTES` porque tem parâmetro: o tipo do
 * componente das rotas fixas é `Record<string, never>` de propósito (página não
 * recebe prop), e a página de detalhe lê o `:id` via `useParams` do wouter.
 */
export const PRODUCT_DETAIL_ROUTE = "/produtos/:id";

export const PRODUCT_DETAIL_COMPONENT = lazy(() => import("@/pages/product-detail"));

/** Monta o caminho do detalhe para links e para a mensagem de reserva. */
export function productDetailPath(productGroupId: number): string {
  return `/produtos/${productGroupId}`;
}

/**
 * Slugs do site antigo (Front-Loja usava rotas em inglês). Redirecionar em vez
 * de quebrar preserva link salvo e indexação existente.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/products": "/produtos",
  "/contact": "/contato",
};

export const NOT_FOUND_COMPONENT = lazy(() => import("@/pages/not-found"));

/** Links da navegação, na ordem de declaração das rotas. */
export const NAV_LINKS = ROUTES.filter((route) => route.label !== undefined);
