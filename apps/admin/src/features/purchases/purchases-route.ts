/**
 * Caminhos da feature de Compras.
 *
 * `PURCHASES_PATH` é a tela; `productFromPurchasePath` é o link que o
 * recebimento de produto NOVO usa para abrir o cadastro de produto já
 * preenchido com a compra (`?compra=<id>`, lido por `useProductDetailFromUrl`).
 * String repetida diverge no primeiro rename — por isso as duas moram aqui.
 */
export const PURCHASES_PATH = "/estoque/compras";

/**
 * Parâmetro "compra". A tela de Produtos o lê para abrir o cadastro a partir de
 * uma compra; a própria tela de Compras o usa para dizer qual compra está
 * aberta na modal.
 */
export const PURCHASE_QUERY_PARAM = "compra";

/** Caminho (relativo à raiz do admin) que abre o cadastro de produto novo preenchido pela compra. */
export function productFromPurchasePath(purchaseId: number): string {
  return `/produtos?${PURCHASE_QUERY_PARAM}=${purchaseId}`;
}

/**
 * Parâmetro que abre a tela de Compras com o formulário JÁ ABERTO para um
 * produto: é o caminho do "Resolver" do relatório de estoque baixo, que só
 * considera o alerta tratado depois que existe um pedido de reposição.
 */
export const NEW_PURCHASE_PRODUCT_PARAM = "produto";

/** Caminho que abre Compras com o pedido de reposição deste produto já começado. */
export function newPurchaseForProductPath(productId: number): string {
  return `${PURCHASES_PATH}?${NEW_PURCHASE_PRODUCT_PARAM}=${productId}`;
}

/**
 * Caminho que abre a tela de Compras já com a modal de UMA compra.
 *
 * É query string, e não segmento de rota, de propósito: aqui a listagem está
 * mesmo aberta com um detalhe pendurado — a modal fecha e a lista continua
 * onde estava, com filtro, busca e página. (No detalhe do produto foi o
 * contrário, e o `?id=` virou `/produtos/<id>/detalhes`.) É o link que se
 * copia da barra de endereços para mandar a compra a alguém; quem o lê é
 * `usePurchaseFromUrl`.
 */
export function purchaseDetailPath(purchaseId: number): string {
  return `${PURCHASES_PATH}?${PURCHASE_QUERY_PARAM}=${purchaseId}`;
}

/** Id de compra pedido numa query string, ou `null` — ids são inteiros positivos. */
export function purchaseIdFromSearch(search: string): number | null {
  const bruto = new URLSearchParams(search).get(PURCHASE_QUERY_PARAM);
  if (bruto === null) return null;
  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Escreve (ou tira, com `null`) o id da compra aberta na barra de endereços.
 *
 * Só o parâmetro muda: o resto da URL fica. E sem entrada nova no histórico —
 * a modal não é uma página, e "voltar" continua saindo da tela, como antes.
 */
export function syncPurchaseDetailParam(purchaseId: number | null): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (purchaseId === null) url.searchParams.delete(PURCHASE_QUERY_PARAM);
  else url.searchParams.set(PURCHASE_QUERY_PARAM, String(purchaseId));
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
