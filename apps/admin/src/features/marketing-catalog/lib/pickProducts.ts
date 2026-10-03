import {
  buildPublicImageUrl,
  enumCode,
  STOREFRONT_STOCK_BADGE,
  type StorefrontProductDto,
} from "@workspace/api-client-react";
import type { CatalogProduct } from "../types";

/**
 * Sorteio PROVISÓRIO dos produtos do banner (etapa 1 do `PLANO-CATALOGO.md`).
 *
 * Enquanto a API de sorteio não existe, o banner "Novidades e promoções" sai da
 * vitrine pública: as ofertas vigentes e os cadastros mais recentes, que é a
 * ordem em que `/Storefront/products` já responde. A etapa 2 troca este arquivo
 * pelo sorteio do servidor, que conhece venda, saldo e dias de loja.
 */

/** Quanto do banner as ofertas podem ocupar. O resto é dos demais produtos. */
const OFFER_SHARE = 1 / 3;

/**
 * Gerador pseudoaleatório com semente (mulberry32).
 *
 * Existe para o sorteio ser REPRODUZÍVEL no teste: com `Math.random` não há
 * como afirmar o que saiu. Em produção a semente é o relógio.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha sem alterar a lista recebida (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/**
 * O card da vitrine no formato do catálogo. `null` para produto sem foto: sem
 * imagem não há o que divulgar.
 */
export function toCatalogProduct(item: StorefrontProductDto): CatalogProduct | null {
  if (!item.imageUrl) return null;

  const promotion = item.promotion ?? null;
  const stockBadge = enumCode(item.stockBadge ?? STOREFRONT_STOCK_BADGE.None, STOREFRONT_STOCK_BADGE);
  const isLastUnits =
    stockBadge === STOREFRONT_STOCK_BADGE.LastUnits || stockBadge === STOREFRONT_STOCK_BADGE.LastUnit;

  return {
    productGroupId: item.productGroupId,
    name: item.name,
    price: promotion ? promotion.price : item.price,
    hasPriceRange: promotion ? promotion.priceMax != null : item.priceMax != null,
    referencePrice: promotion?.referencePrice ?? undefined,
    imageUrl: buildPublicImageUrl(item.imageUrl),
    // Um selo só, e a oferta vence: é ela que muda o preço impresso no card.
    badge: promotion ? "offer" : isLastUnits ? "lastUnits" : undefined,
  };
}

/**
 * Escolhe até `count` produtos: as ofertas primeiro (no máximo um terço das
 * vagas), e o resto sorteado entre os demais.
 *
 * O teto das ofertas é o mesmo raciocínio da seção Novidades do site: com
 * muitas promoções no ar, o banner viraria só oferta e deixaria de mostrar o
 * que chegou. Faltando produto sem oferta para completar, as ofertas que
 * sobraram entram.
 *
 * @param count Quantos produtos o banner leva — é sobre ELE que o teto das
 *   ofertas é calculado.
 * @param spare Reservas devolvidas DEPOIS dos `count`, para o produto de foto
 *   fora do ar ceder a vaga. São produtos sem oferta primeiro: somar a folga ao
 *   `count` fazia o teto virar 4 em 9 (um terço de 13), e não 3.
 */
export function pickStoryProducts(
  items: readonly StorefrontProductDto[],
  count: number,
  random: () => number,
  spare = 0,
): CatalogProduct[] {
  const products = items.map(toCatalogProduct).filter((product) => product !== null);
  const offers = shuffle(
    products.filter((product) => product.badge === "offer"),
    random,
  );
  const others = shuffle(
    products.filter((product) => product.badge !== "offer"),
    random,
  );

  const offerSlots = Math.min(offers.length, Math.floor(count * OFFER_SHARE));
  const othersInBanner = Math.min(others.length, count - offerSlots);
  const offersInBanner = Math.min(offers.length, count - othersInBanner);

  const banner = [...offers.slice(0, offersInBanner), ...others.slice(0, othersInBanner)];
  const reserves = [...others.slice(othersInBanner), ...offers.slice(offersInBanner)].slice(0, spare);

  return [...banner, ...reserves];
}
