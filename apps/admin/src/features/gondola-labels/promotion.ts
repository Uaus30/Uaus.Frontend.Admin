import { PRODUCT_LABEL_TYPE } from "@workspace/api-client-react";
import { PROMOTION_KIND_LABEL, type ShelfPrice } from "@workspace/core";
import {
  formatPriceInput,
  parsePriceInput,
  type LabelDraftItem,
  type LabelPromotion,
  type LabelTypeCode,
} from "./types";

/**
 * A promoção na etiqueta de gôndola (pedido do dono, 05/10/2026).
 *
 * A etiqueta segue a mesma regra de anúncio da listagem e do balcão
 * (`shelfPrice` do `@workspace/core`): relâmpago e Dia a Dia saem com o preço
 * promocional, o de tabela riscado acima ("De R$ 12,90") e o selo do tipo
 * embaixo; o combo sai com o preço normal e o resumo da oferta no selo.
 *
 * **O tipo da etiqueta é a chave.** Produto em promoção entra no lote como
 * Promoção (amarela) e com o preço promocional; trocar o tipo para Normal volta
 * ao preço de tabela e tira o "De" e o selo — é o caminho para imprimir a
 * etiqueta que fica na gôndola depois do sábado sem desligar a relâmpago. A
 * Queima de Estoque (vermelha) também leva a promoção.
 *
 * **A promoção é derivada, nunca guardada no rascunho** — como o preço. A lista
 * fica dias aberta; a relâmpago de sábado não pode entrar numa etiqueta impressa
 * na quarta, nem sumir da que é impressa no próprio sábado. O que o lote IMPRESSO
 * congela é o papel: o "De" e o selo vão no pedido, como o preço.
 */

/** A promoção da etiqueta a partir do preço de anúncio do produto. Nula sem promoção. */
export function labelPromotionOf(shelf: ShelfPrice): LabelPromotion | null {
  if (shelf.kind === "regular") return null;

  if (shelf.kind === "combo") return { price: null, referencePrice: null, seal: shelf.offer };

  return {
    price: shelf.price,
    // A isca do Dia a Dia (desconto zero) tem selo, mas não tem "de".
    referencePrice: shelf.price < shelf.referencePrice ? shelf.referencePrice : null,
    seal: PROMOTION_KIND_LABEL[shelf.promotion.kind],
  };
}

/** O tipo com que um produto entra no lote: Promoção quando há promoção valendo. */
export function defaultLabelTypeOf(promotion: LabelPromotion | null | undefined): LabelTypeCode {
  return promotion ? PRODUCT_LABEL_TYPE.Promotion : PRODUCT_LABEL_TYPE.Normal;
}

/**
 * O preço que a etiqueta tem quando ninguém o editou: o promocional na etiqueta
 * de oferta de um produto em relâmpago ou Dia a Dia, e o de tabela no resto
 * (etiqueta Normal, combo, produto sem promoção).
 *
 * É a régua do "editado": preço igual a este segue o cadastro e a promoção, e
 * não vai para o rascunho.
 */
export function expectedLabelPrice(
  item: Pick<LabelDraftItem, "labelType" | "promotion" | "catalogPrice">,
): number {
  const promocional = item.labelType !== PRODUCT_LABEL_TYPE.Normal ? item.promotion?.price : null;
  return promocional ?? item.catalogPrice;
}

/** Valor em centavos, para comparar preço sem tropeçar no ponto flutuante. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/** O preço da linha não foi editado: é o que a etiqueta teria sozinha. */
function followsExpectedPrice(item: LabelDraftItem): boolean {
  return toCents(parsePriceInput(item.priceInput)) === toCents(expectedLabelPrice(item));
}

function samePromotion(a: LabelPromotion | null | undefined, b: LabelPromotion | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.price === b.price && a.referencePrice === b.referencePrice && a.seal === b.seal;
}

/**
 * Atualiza a promoção de um item — a lista de promoções chegou, mudou, ou o
 * rascunho acabou de ser lido.
 *
 * O preço digitado só acompanha quando ele não foi editado: a oferta que alguém
 * digitou à mão continua a dele. Sem mudança, devolve o MESMO item, para a
 * releitura de cinco minutos não redesenhar a lista inteira.
 */
export function withLabelPromotion(item: LabelDraftItem, promotion: LabelPromotion | null): LabelDraftItem {
  if (samePromotion(item.promotion, promotion)) return item;

  const atualizado = { ...item, promotion };
  return followsExpectedPrice(item)
    ? { ...atualizado, priceInput: formatPriceInput(expectedLabelPrice(atualizado)) }
    : atualizado;
}

/**
 * Troca o tipo da etiqueta levando o preço junto quando ele não foi editado: de
 * Promoção para Normal, o promocional dá lugar ao de tabela, e de volta.
 */
export function withLabelType(item: LabelDraftItem, labelType: LabelTypeCode): LabelDraftItem {
  const atualizado = { ...item, labelType };
  return followsExpectedPrice(item)
    ? { ...atualizado, priceInput: formatPriceInput(expectedLabelPrice(atualizado)) }
    : atualizado;
}
