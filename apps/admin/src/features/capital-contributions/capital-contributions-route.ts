/**
 * Caminhos da tela de Aportes (23/11/2026).
 *
 * `newCapitalContributionPath` é o atalho "Lançar aporte" do Painel
 * Financeiro: a tela abre com a modal de lançamento já aberta.
 */
export const CAPITAL_CONTRIBUTIONS_PATH = "/financeiro/aportes";

/** Parâmetro que abre a tela com a modal de novo aporte aberta. */
export const NEW_CONTRIBUTION_PARAM = "novo";

/** A tela de Aportes com a modal de lançamento aberta. */
export function newCapitalContributionPath(): string {
  return `${CAPITAL_CONTRIBUTIONS_PATH}?${NEW_CONTRIBUTION_PARAM}=1`;
}

/** A busca da URL pede a modal aberta? (`?novo=1`) */
export function asksNewContribution(search: string): boolean {
  return new URLSearchParams(search).has(NEW_CONTRIBUTION_PARAM);
}

/**
 * Tira o `?novo=1` da barra de endereços, mantendo o resto.
 *
 * Sem isso, um F5 depois de lançar o aporte reabriria a modal vazia, como se a
 * pessoa tivesse pedido outro. `replaceState`, e não navegação: a tela é a
 * mesma, e o voltar do navegador não deve passar por ela de novo.
 */
export function clearNewContributionParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(NEW_CONTRIBUTION_PARAM)) return;
  url.searchParams.delete(NEW_CONTRIBUTION_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
