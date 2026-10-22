import { MAX_SALE_PRICE, suggestedSalePrice } from "@workspace/core";

type DefaultSuggestedPriceParams = {
  /** A compra aponta para um produto cadastrado (reposição) — ver `purchaseHasProduct`. */
  hasProduct: boolean;
  /** Preço atual do produto escolhido, quando se sabe. */
  productPrice: number | null;
  /** Preço de cada variação do grupo, quando a lista já chegou. */
  groupPrices: number[];
  /** Custo unitário final da compra. */
  unitCost: number;
};

/**
 * O preço de venda com que o campo "Preço sugerido" nasce, até alguém mexer nele.
 *
 * - **Reposição** (produto já cadastrado, 22/10/2026, pedido do dono): o preço
 *   ATUAL do produto. Repor não é decidir preço de novo, e a sugestão pela margem
 *   trocava a etiqueta de quem só queria repor. Variações com preços DIFERENTES
 *   nascem em branco: um preço único no recebimento achataria os outros, e em
 *   branco cada variação mantém o seu — é a regra do backend (`ReceiveAsync`).
 * - **Produto novo**: 40% de margem sobre o custo (`suggestedSalePrice`), como
 *   desde 13/09/2026.
 *
 * Nos dois casos o teto da loja vale: nunca acima de {@link MAX_SALE_PRICE}.
 * Zero é "em branco", que mantém o preço atual no recebimento.
 */
export function defaultSuggestedPrice({
  hasProduct,
  productPrice,
  groupPrices,
  unitCost,
}: DefaultSuggestedPriceParams): number {
  if (!hasProduct) return suggestedSalePrice(unitCost) ?? 0;

  const precos = groupPrices.filter((preco) => preco > 0);
  const atual = precos.length > 0 ? (new Set(precos).size === 1 ? precos[0] : 0) : (productPrice ?? 0);
  return Math.min(atual, MAX_SALE_PRICE);
}

/** As variações do grupo têm preços diferentes entre si? */
export function variationPricesDiffer(groupPrices: number[]): boolean {
  return new Set(groupPrices.filter((preco) => preco > 0)).size > 1;
}
