import {
  promotionDiscountKindFromCode,
  promotionKindFromCode,
  resolveShelfPromotion,
  shelfPrice,
  type PromotionRule,
  type ShelfPrice,
} from "@workspace/core";
import type { LocalPromotion } from "@/offline";
import { coveredGroupIds } from "./combo-promotions";

/**
 * O preço que a BUSCA do balcão anuncia — antes de o item entrar no carrinho.
 *
 * Pedido do dono (05/10/2026): "no PDV precisamos deixar claro o preço
 * promocional já na listagem para não gerar dúvidas". Até aqui o selo e o preço
 * da promoção só apareciam no carrinho, e quando o cliente perguntava "quanto
 * custa o copo?", o operador lia o preço de tabela na lista.
 *
 * A regra do anúncio é a do `@workspace/core` (`resolveShelfPromotion` e
 * `shelfPrice`), a mesma da listagem do admin e da etiqueta; a conta da unidade é
 * a mesma do carrinho. Este arquivo só traduz a promoção da base local para ela.
 */

/**
 * A promoção da base local no formato da regra de anúncio. Nula quando o tipo ou
 * o desconto não são conhecidos — promoção sem espécie não casa com produto
 * nenhum, igual ao carrinho.
 */
export function toShelfRule(promotion: LocalPromotion): PromotionRule | null {
  const kind = promotionKindFromCode(promotion.type);
  const discountKind = promotionDiscountKindFromCode(promotion.discountType);
  if (!kind || !discountKind) return null;

  return {
    id: promotion.id,
    kind,
    discountKind,
    discountValue: promotion.discountValue,
    productGroupIds: coveredGroupIds(promotion),
    comboQuantity: promotion.comboQuantity ?? null,
    validFrom: promotion.validFrom,
    validUntil: promotion.validUntil,
    maxQuantityPerSale: promotion.maxQuantityPerSale,
  };
}

/** As promoções da base local, traduzidas uma vez para várias consultas. */
export function toShelfRules(promotions: readonly LocalPromotion[]): PromotionRule[] {
  return promotions.map(toShelfRule).filter((rule): rule is PromotionRule => rule !== null);
}

/**
 * O preço da linha da busca.
 *
 * @param productGroupId Grupo do produto. Ausente numa API anterior a 19/09/2026:
 *   aí a busca mostra o preço de tabela, como o carrinho, que também não aplica.
 * @param instant O instante da venda em curso, se houver — o mesmo que o carrinho
 *   congelou —, senão agora.
 */
export function searchResultPrice(
  rules: readonly PromotionRule[],
  product: { price: number; productGroupId?: number | null },
  instant: string,
): ShelfPrice {
  return shelfPrice(product.price, resolveShelfPromotion(rules, product.productGroupId, instant));
}
