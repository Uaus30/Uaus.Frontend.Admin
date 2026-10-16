import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, enumCode } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import { promotionSituation } from "./promotionRules";
import type { PromotionDto, PromotionRow } from "../types";

/**
 * O banner de promoção impresso (pedido do dono, 16/10/2026): a faixa vermelha
 * "PROMOÇÃO", o nome do produto e o preço, quatro por folha A4 — o cartaz que
 * vai na gôndola ou na porta no sábado.
 *
 * Nada aqui vai ao servidor: a modal escolhe as promoções, reescreve o nome SÓ
 * para o papel e abre a folha numa aba nova. Não há lote nem histórico, de
 * propósito — o banner é descartável, e a aba aberta é a reimpressão.
 */

/** O que sai impresso em um banner. */
export interface PromotionBannerItem {
  /** Nome do produto como vai no papel — o do cadastro ou o reescrito na modal. */
  productName: string;
  /** A linha pequena acima do preço: "3 por", "A partir de". Vazia na promoção simples. */
  lead: string;
  /** O preço anunciado, em reais — o número grande. */
  price: number;
  /** Quantas vezes o banner se repete na folha. */
  copies: number;
}

/** O que a modal guarda de cada promoção: marcada, nome reescrito e cópias. */
export interface PromotionBannerEdit {
  selected: boolean;
  /** O nome digitado. Vazio = o nome do cadastro (é o placeholder do campo). */
  name: string;
  copies: number;
}

/** O título da faixa vermelha quando ninguém o reescreve. */
export const DEFAULT_BANNER_TITLE = "PROMOÇÃO";

/**
 * O título que sai na faixa: o digitado na modal, ou "PROMOÇÃO" se o campo
 * ficou vazio (é o placeholder). Um título para a impressão inteira — a loja
 * troca "PROMOÇÃO" por "OFERTA" ou "SÓ HOJE" para a folha, não por produto.
 */
export function bannerTitleOf(title: string): string {
  return title.trim() || DEFAULT_BANNER_TITLE;
}

/** Teto de cópias de um banner: cinco folhas do mesmo cartaz já é papel demais. */
export const BANNER_MAX_COPIES = 20;

/** Promoção ainda sem edição na modal. */
export const DEFAULT_BANNER_EDIT: PromotionBannerEdit = { selected: false, name: "", copies: 1 };

/**
 * O preço que o banner anuncia.
 *
 * Segue a listagem, não refaz a conta: o promocional vem do servidor
 * (`promotionalPriceMin`), a mesma conta do balcão. O que o banner decide é só
 * a FRASE:
 *
 * - combo "a cada N" (preço do kit): "3 por" e o preço do kit — é o cartaz que
 *   a loja já faz à mão ("3 esmaltes por R$ 20");
 * - combo "a partir de N": "A partir de 3 un." e o preço de cada uma;
 * - variações com preços diferentes (percentual sobre R$ 12 e R$ 18): "A partir
 *   de" e o menor — um preço só mentiria para metade delas, a mesma razão do
 *   "A partir de" da vitrine.
 */
export function bannerPriceOf(promotion: PromotionDto): { lead: string; price: number } {
  const type = enumCode(promotion.type, PROMOTION_TYPE);
  const discountType = enumCode(promotion.discountType, PROMOTION_DISCOUNT_TYPE);

  if (type === PROMOTION_TYPE.Combo && promotion.comboQuantity != null) {
    if (discountType === PROMOTION_DISCOUNT_TYPE.KitPrice) {
      return { lead: `${promotion.comboQuantity} por`, price: promotion.discountValue };
    }
    return { lead: `A partir de ${promotion.comboQuantity} un.`, price: promotion.promotionalPriceMin };
  }

  return {
    lead: promotion.promotionalPriceMin < promotion.promotionalPriceMax ? "A partir de" : "",
    price: promotion.promotionalPriceMin,
  };
}

/** O preço como a modal o mostra ao lado do nome: "3 por R$ 20,00". */
export function bannerPriceLabel(promotion: PromotionDto): string {
  const { lead, price } = bannerPriceOf(promotion);
  return lead ? `${lead} ${formatCurrency(price)}` : formatCurrency(price);
}

/**
 * As promoções que valem um banner: as NO AR e as PROGRAMADAS, com as no ar na
 * frente.
 *
 * A programada entra porque o cartaz de sábado é impresso na sexta. A encerrada
 * e a inativa ficam de fora: cartaz de promoção que acabou é o erro que a loja
 * só percebe quando o cliente reclama no caixa.
 */
export function bannerCandidates(promotions: PromotionDto[], now = new Date()): PromotionRow[] {
  const rows = promotions.map((promotion) => ({
    ...promotion,
    situation: promotionSituation(promotion, now),
  }));
  const noAr = rows.filter((row) => row.situation === "no-ar");
  const programadas = rows.filter((row) => row.situation === "programada");
  return [...noAr, ...programadas];
}

/** Cópias dentro do intervalo: campo vazio, zero ou bobagem vira 1; acima do teto, o teto. */
export function clampBannerCopies(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(BANNER_MAX_COPIES, Math.floor(value));
}

/**
 * Os banners que saem no papel, na ordem da lista: só as promoções marcadas,
 * com o nome reescrito (ou o do cadastro, se o campo ficou vazio) e as cópias.
 *
 * A edição de uma promoção que já saiu da lista (encerrada entre uma impressão
 * e outra) não vira banner: a lista é a verdade, a edição é só o que a pessoa
 * digitou por cima dela.
 */
export function bannerItemsOf(
  candidates: PromotionRow[],
  edits: Record<number, PromotionBannerEdit | undefined>,
): PromotionBannerItem[] {
  return candidates.flatMap((promotion) => {
    const edit = edits[promotion.id];
    if (!edit?.selected) return [];

    const { lead, price } = bannerPriceOf(promotion);
    const productName = edit.name.trim() || promotion.productGroupName;
    return [{ productName, lead, price, copies: clampBannerCopies(edit.copies) }];
  });
}
