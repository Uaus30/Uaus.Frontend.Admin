import {
  buildPublicImageUrl,
  CATALOG_ROLE,
  enumCode,
  STOREFRONT_STOCK_BADGE,
  type CatalogItemDto,
} from "@workspace/api-client-react";
import type { CatalogBadge, CatalogProduct, CatalogRole } from "../types";

/** O papel da API (número) no nome que a tela usa. */
const ROLE_BY_CODE: Record<number, CatalogRole> = {
  [CATALOG_ROLE.Offer]: "offer",
  [CATALOG_ROLE.New]: "new",
  [CATALOG_ROLE.BestSeller]: "bestSeller",
  [CATALOG_ROLE.Regular]: "regular",
  [CATALOG_ROLE.Slow]: "slow",
};

/** O caminho de volta: é o código que a troca de um produto manda ao servidor. */
export const ROLE_CODE: Record<CatalogRole, number> = {
  offer: CATALOG_ROLE.Offer,
  new: CATALOG_ROLE.New,
  bestSeller: CATALOG_ROLE.BestSeller,
  regular: CATALOG_ROLE.Regular,
  slow: CATALOG_ROLE.Slow,
};

/** Como o papel aparece na lista de produtos da tela. */
export const ROLE_LABEL: Record<CatalogRole, string> = {
  offer: "Oferta",
  new: "Novidade",
  bestSeller: "Mais vendido",
  regular: "Intermediário",
  slow: "Achado",
};

/**
 * Um selo só por card, e a prioridade é a do que muda a decisão do cliente: a
 * oferta mexe no preço impresso, a novidade é a notícia, e a escassez vem por
 * último.
 */
function badgeOf(hasPromotion: boolean, role: CatalogRole, isLastUnits: boolean): CatalogBadge | undefined {
  if (hasPromotion) return "offer";
  if (role === "new") return "new";
  return isLastUnits ? "lastUnits" : undefined;
}

/**
 * O item sorteado no formato do molde. `null` para card sem foto: sem imagem
 * não há o que divulgar (o servidor já filtra; isto é a rede de segurança).
 *
 * O preço NÃO é recalculado aqui. O card é o da vitrine, e a peça imprime o que
 * ele traz: `promotion.price` quando há oferta, o de tabela quando não há, e o
 * "de" só quando o servidor o manda (corte acima de 5%).
 */
export function toCatalogProduct(item: CatalogItemDto): CatalogProduct | null {
  const card = item.product;
  if (!card.imageUrl) return null;

  const promotion = card.promotion ?? null;
  const role = ROLE_BY_CODE[enumCode(item.role, CATALOG_ROLE)] ?? "regular";
  const stockBadge = enumCode(card.stockBadge ?? STOREFRONT_STOCK_BADGE.None, STOREFRONT_STOCK_BADGE);
  const isLastUnits =
    stockBadge === STOREFRONT_STOCK_BADGE.LastUnits || stockBadge === STOREFRONT_STOCK_BADGE.LastUnit;

  return {
    productGroupId: card.productGroupId,
    name: card.name,
    price: promotion ? promotion.price : card.price,
    hasPriceRange: promotion ? promotion.priceMax != null : card.priceMax != null,
    referencePrice: promotion?.referencePrice ?? undefined,
    imageUrl: buildPublicImageUrl(card.imageUrl),
    role,
    badge: badgeOf(promotion !== null, role, isLastUnits),
  };
}

/** A lista sorteada no formato do molde, na ordem recebida e sem os cards sem foto. */
export function toCatalogProducts(items: readonly CatalogItemDto[]): CatalogProduct[] {
  return items.map(toCatalogProduct).filter((product) => product !== null);
}
