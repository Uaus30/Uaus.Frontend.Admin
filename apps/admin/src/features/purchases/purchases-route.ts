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
