/**
 * Caminhos da feature de Compras.
 *
 * `PURCHASES_PATH` é a tela; `productFromPurchasePath` é o link que o
 * recebimento de produto NOVO usa para abrir o cadastro de produto já
 * preenchido com a compra (`?compra=<id>`, lido por `useProductDetailFromUrl`).
 * String repetida diverge no primeiro rename — por isso as duas moram aqui.
 */
export const PURCHASES_PATH = "/estoque/compras";

/** Parâmetro que a tela de Produtos lê para abrir o cadastro a partir de uma compra. */
export const PURCHASE_QUERY_PARAM = "compra";

/** Caminho (relativo à raiz do admin) que abre o cadastro de produto novo preenchido pela compra. */
export function productFromPurchasePath(purchaseId: number): string {
  return `/produtos?${PURCHASE_QUERY_PARAM}=${purchaseId}`;
}
