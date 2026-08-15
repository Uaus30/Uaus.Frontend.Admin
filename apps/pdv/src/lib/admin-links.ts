/**
 * Links para o painel administrativo.
 *
 * O PDV é publicado sob `/pdv/` no mesmo host do admin (é o que o `BASE_URL` do
 * Vite e o tratamento de 401 do api-client assumem), então o padrão é subir um
 * nível. `VITE_ADMIN_URL` sobrescreve isso para quem hospeda os dois em domínios
 * separados.
 */

/** Base do painel administrativo, sem barra no fim. */
export function adminBaseUrl(): string {
  const configurada = import.meta.env.VITE_ADMIN_URL;
  if (typeof configurada === "string" && configurada.trim()) {
    return configurada.trim().replace(/\/+$/, "");
  }

  // Sem janela (teste, SSR) não há origem de onde derivar.
  if (typeof window === "undefined") return "";

  return window.location.origin;
}

/** URL da tela inicial do painel. */
export function adminHomeUrl(): string {
  return `${adminBaseUrl()}/`;
}

/**
 * URL da tela de produtos do admin já filtrada no produto informado.
 *
 * A rota de produtos não recebe id na URL — a edição abre por modal depois da
 * busca. Levar o termo por query string é o que existe hoje para chegar perto do
 * produto sem inventar uma rota nova no admin.
 *
 * @param termo Código de barras ou nome, o que identificar melhor o produto.
 */
export function adminProductSearchUrl(termo: string): string {
  return `${adminBaseUrl()}/produtos?busca=${encodeURIComponent(termo)}`;
}

/**
 * Abre uma URL em nova aba com segurança.
 *
 * `noopener` é o que importa: sem ele a página aberta recebe `window.opener` e
 * pode navegar a aba do PDV para outro lugar — com o caixa aberto e uma venda em
 * andamento na tela.
 */
export function openInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
