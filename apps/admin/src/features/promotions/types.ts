import type { PromotionDiscountTypeCode, PromotionDto, PromotionTypeCode } from "@workspace/api-client-react";

export type {
  PromotionDetailsDto,
  PromotionDiscountTypeCode,
  PromotionDto,
  PromotionPreviewDto,
  PromotionTypeCode,
  PromotionVariationDto,
  SavePromotionPayload,
} from "@workspace/api-client-react";

/**
 * O formulário da promoção.
 *
 * Datas e horas ficam SEPARADAS de propósito: o `DatePicker` do `packages/ui`
 * trabalha só com `Date` de calendário — e é assim que ele deve continuar, porque
 * a maioria das telas escolhe dia. O controle de hora é montado aqui dentro da
 * feature, e a composição do instante `"yyyy-MM-ddTHH:mm:ss"` acontece em
 * `promotionRules`, longe do `toISOString()` que grava a véspera.
 *
 * Números são STRING enquanto o formulário está aberto: campo vazio e "digitou
 * bobagem" são estados diferentes de "zero", e `parseAmountOrNull` é quem os
 * separa na hora de montar o payload.
 */
export interface PromotionForm {
  productGroupId: number | null;
  /** Nome do produto escolhido, só para a tela mostrar sem consultar de novo. */
  productGroupName: string;
  type: PromotionTypeCode;
  discountType: PromotionDiscountTypeCode;
  /** Percentual ou preço final, como foi digitado. */
  discountValue: string;
  /** Dia do início. Na relâmpago é O dia da promoção — início e fim são o mesmo. */
  startDate?: Date;
  /** Hora do início, `"HH:mm"`. */
  startTime: string;
  /** Dia do fim. Ignorado na relâmpago, que termina no dia em que começa. */
  endDate?: Date;
  /** Hora do fim, `"HH:mm"`. */
  endTime: string;
  /** Dia a Dia sem prazo: o fim não é enviado. */
  noEndDate: boolean;
  /** Teto de unidades por venda. Vazio = sem limite. */
  maxQuantityPerSale: string;
  /** Meta de unidades. Vazia = a nota usa a meta calculada. */
  targetQuantity: string;
  isActive: boolean;
  showOnSite: boolean;
}

/**
 * Situação da promoção, derivada da vigência e do indicador de ativa.
 *
 * Não vem da API de propósito: é a mesma decisão da listagem de campanhas — o
 * servidor manda os instantes, a tela decide a palavra. Um campo calculado no
 * backend envelheceria dentro do cache do React Query, e "No ar" continuaria
 * escrito depois de a promoção acabar.
 */
export type PromotionSituation = "no-ar" | "programada" | "encerrada" | "inativa";

/** O que a linha da tabela precisa, sem a tabela conhecer o DTO inteiro. */
export interface PromotionRow extends PromotionDto {
  situation: PromotionSituation;
}
