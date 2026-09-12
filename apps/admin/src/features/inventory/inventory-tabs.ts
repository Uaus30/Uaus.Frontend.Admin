/**
 * As duas abas da tela de Inventário e o parâmetro que escolhe qual abre.
 *
 * `?aba=conferencia` existe para a conferência ser **endereçável**: a tarja da
 * tela de produto devolve o operador para cá depois de marcar um item, e cair
 * na Listagem Geral obrigaria um clique a cada produto conferido.
 */

/** Aba aberta na tela de Inventário. */
export type InventoryTab = "listagem" | "conferencia";

/** Parâmetro da barra de endereços: `?aba=conferencia`. */
export const INVENTORY_TAB_PARAM = "aba";

/** Caminho do inventário já pedindo a aba de conferência. */
export function inventoryCountTabPathname(): string {
  return `${import.meta.env.BASE_URL}estoque/inventario?${INVENTORY_TAB_PARAM}=conferencia`;
}

/**
 * Aba pedida pela URL atual, lida UMA vez, antes do primeiro render.
 *
 * Qualquer outro valor cai na listagem: a aba vem da barra de endereços, que
 * qualquer um edita, e um valor desconhecido não pode deixar a tela sem aba
 * selecionada.
 */
export function inventoryTabFromUrl(): InventoryTab {
  if (typeof window === "undefined") return "listagem";

  return new URLSearchParams(window.location.search).get(INVENTORY_TAB_PARAM) === "conferencia"
    ? "conferencia"
    : "listagem";
}

/**
 * Espelha a aba escolhida na barra de endereços, sem empurrar histórico.
 *
 * `replaceState` e não `pushState`: trocar de aba não é navegação, e um voltar
 * do navegador que só desfizesse cliques em aba não levaria a pessoa a lugar
 * nenhum.
 */
export function syncInventoryTabToUrl(tab: InventoryTab): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (tab === "conferencia") url.searchParams.set(INVENTORY_TAB_PARAM, tab);
  else url.searchParams.delete(INVENTORY_TAB_PARAM);

  window.history.replaceState(window.history.state, "", url.toString());
}
