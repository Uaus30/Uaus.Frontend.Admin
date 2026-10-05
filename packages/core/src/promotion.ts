import { formatCurrency, round2 } from "./money";

/**
 * O preço com promoção como as telas o MOSTRAM — listagem e detalhe de produtos,
 * busca do balcão, etiqueta de gôndola, vitrine e catálogo de divulgação.
 *
 * ## Não é a conta do carrinho
 *
 * Quanto o cliente paga quem decide é `allocatePromotions` do PDV (limite por
 * venda, kit que fecha no centavo, precedência sobre o carrinho inteiro), e o
 * servidor confere com `PromotionRules`. Aqui a pergunta é outra: "olhando UM
 * produto, que preço eu anuncio?". As duas respostas usam a MESMA conta de
 * unidade (`promotionalUnitPrice`) e a MESMA precedência — Relâmpago, Combo,
 * Dia a Dia —, e é isso que impede a etiqueta de prometer um preço que o caixa
 * não cobra.
 *
 * ## As duas formas de anunciar
 *
 * - **Preço de unidade** (Relâmpago e Dia a Dia): o promocional ocupa o lugar do
 *   preço, com o de tabela riscado acima ("De R$ 12,90 / por R$ 9,90") e o selo
 *   do tipo embaixo.
 * - **Combo** ("3 por R$ 20", "a partir de 2"): o preço de UMA unidade não muda —
 *   a quarta unidade de um "3 por 20" sai a preço cheio. O preço normal continua
 *   o principal, e o resumo da oferta vai no selo ("3 por R$ 20,00", "R$ 6,50 pra
 *   2+"). Traduzir o kit num "de/por" anunciaria um preço avulso que o caixa não
 *   pratica.
 */

/** Espécie da promoção, no vocabulário da tela. */
export type PromotionKind = "everyday" | "flash" | "combo";

/** Como o desconto é expresso. O preço do kit só existe no combo "a cada N". */
export type PromotionDiscountKind = "percentage" | "finalPrice" | "kitPrice";

/** Nome de cada espécie, como a loja fala e o selo imprime. */
export const PROMOTION_KIND_LABEL: Record<PromotionKind, string> = {
  everyday: "Dia a Dia",
  flash: "Relâmpago",
  combo: "Combo",
};

/**
 * Espécie a partir do código do enum `PromotionType` da API (1 Dia a Dia, 2
 * Relâmpago, 3 Combo — os mesmos de `PROMOTION_TYPE` do `api-client`, que este
 * pacote não pode importar). Código desconhecido é nulo, e promoção sem espécie
 * não casa com produto nenhum.
 */
export function promotionKindFromCode(code: number): PromotionKind | null {
  if (code === 1) return "everyday";
  if (code === 2) return "flash";
  if (code === 3) return "combo";
  return null;
}

/**
 * Tipo de desconto a partir do código do enum `PromotionDiscountType` da API (1
 * percentual, 2 preço final, 3 preço do kit). Desconhecido é nulo.
 */
export function promotionDiscountKindFromCode(code: number): PromotionDiscountKind | null {
  if (code === 1) return "percentage";
  if (code === 2) return "finalPrice";
  if (code === 3) return "kitPrice";
  return null;
}

/** Uma promoção como REGRA — o que se precisa para decidir o preço de vitrine. */
export interface PromotionRule {
  id: number;
  kind: PromotionKind;
  discountKind: PromotionDiscountKind;
  /** Percentual (0 a 90), preço final ou preço do kit, em reais, conforme o tipo. */
  discountValue: number;
  /** Os grupos que a promoção alcança — no combo, todos os que somam unidades. */
  productGroupIds: number[];
  /** Unidades do combo (o "3" de "3 por R$ 20"). Nulo fora dele. */
  comboQuantity: number | null;
  /** Início da vigência, inclusivo, no horário local sem fuso (`2026-10-11T08:00:00`). */
  validFrom: string;
  /** Fim da vigência, inclusivo. Nulo = sem prazo. */
  validUntil: string | null;
  /** Teto de unidades do grupo por venda. Nulo = sem limite. */
  maxQuantityPerSale: number | null;
}

/**
 * Preço promocional de UMA unidade.
 *
 * Espelha `PromotionRules.PromotionalPrice` do backend: o arredondamento é por
 * unidade, e nunca devolve negativo. O preço do kit não é preço de unidade —
 * quem o reparte é o carrinho —, então ele devolve o próprio preço.
 */
export function promotionalUnitPrice(
  price: number,
  discountKind: PromotionDiscountKind | null,
  discountValue: number,
): number {
  if (discountKind === "percentage") return Math.max(0, round2(price * (1 - discountValue / 100)));
  if (discountKind === "finalPrice") return Math.max(0, round2(discountValue));
  return price;
}

/**
 * A promoção vale neste instante? As duas pontas são inclusivas, e fim nulo é
 * sem prazo — o mesmo predicado de `PromotionRules.IsInWindow`.
 *
 * A comparação é de TEXTO, e funciona porque os dois lados estão no mesmo
 * formato local sem fuso, que é ordenável (`toLocalTimestamp`).
 */
export function isPromotionInWindow(
  rule: Pick<PromotionRule, "validFrom" | "validUntil">,
  instant: string,
): boolean {
  return rule.validFrom <= instant && (rule.validUntil == null || rule.validUntil >= instant);
}

/** Combo de verdade: a espécie e uma quantidade que forme o kit. */
function isRealCombo(rule: PromotionRule): boolean {
  return rule.kind === "combo" && (rule.comboQuantity ?? 0) >= 2;
}

/**
 * A promoção que um produto ANUNCIA neste instante, ou nula.
 *
 * **Relâmpago, Combo, Dia a Dia** — a precedência do carrinho
 * (`allocatePromotions`): a relâmpago é evento e vence tudo enquanto dura; combo
 * e Dia a Dia no mesmo grupo o cadastro recusa, e se chegassem juntos o combo
 * venceria, como no caixa.
 *
 * @param productGroupId Grupo do produto — a promoção é do grupo, não da variação.
 * @param instant Agora, no formato de `toLocalTimestamp`.
 */
export function resolveShelfPromotion(
  rules: readonly PromotionRule[],
  productGroupId: number | null | undefined,
  instant: string,
): PromotionRule | null {
  if (!productGroupId) return null;

  const vigentes = rules.filter(
    (rule) =>
      rule.productGroupIds.includes(productGroupId) &&
      isPromotionInWindow(rule, instant) &&
      (rule.kind !== "combo" || isRealCombo(rule)),
  );

  return (
    vigentes.find((rule) => rule.kind === "flash") ??
    vigentes.find((rule) => rule.kind === "combo") ??
    vigentes.find((rule) => rule.kind === "everyday") ??
    null
  );
}

/** O preço como a tela deve desenhá-lo. */
export type ShelfPrice =
  /** Sem promoção que mude o anúncio: o preço de tabela, e só. */
  | { kind: "regular"; price: number }
  /**
   * Relâmpago ou Dia a Dia: `price` é o promocional e `referencePrice` o de
   * tabela. Iguais na isca do Dia a Dia (percentual zero, o pote de R$ 2,00 da
   * porta): aí não há "de", mas o selo continua — para o cliente aquele preço É
   * promocional.
   */
  | { kind: "unit"; price: number; referencePrice: number; promotion: PromotionRule }
  /** Combo: `price` continua o de tabela, e `offer` é o resumo do selo. */
  | { kind: "combo"; price: number; offer: string; promotion: PromotionRule };

/**
 * O que a tela mostra para um produto de preço `price` com a promoção dada.
 *
 * Duas recusas, as duas para não anunciar o que o caixa desmente:
 * - preço promocional ACIMA do de tabela (cadastro que o serviço recusa, mas que
 *   uma troca de preço posterior pode produzir) volta ao preço normal — seria um
 *   "desconto" que sobe o preço;
 * - combo em que a unidade do kit sai mais cara que a avulsa não dá desconto no
 *   carrinho (`ComboDiscount` nunca sobe o preço), e por isso não ganha selo.
 */
export function shelfPrice(price: number, promotion: PromotionRule | null): ShelfPrice {
  const tabela = round2(price);
  if (!promotion) return { kind: "regular", price: tabela };

  if (promotion.kind === "combo") {
    const quantidade = promotion.comboQuantity ?? 0;
    const porUnidade =
      promotion.discountKind === "kitPrice"
        ? round2(promotion.discountValue / quantidade)
        : promotionalUnitPrice(tabela, promotion.discountKind, promotion.discountValue);

    if (quantidade < 2 || porUnidade >= tabela) return { kind: "regular", price: tabela };

    return {
      kind: "combo",
      price: tabela,
      offer: describeComboOffer(
        {
          quantity: quantidade,
          discountKind: promotion.discountKind,
          discountValue: promotion.discountValue,
        },
        tabela,
      ),
      promotion,
    };
  }

  const promocional = promotionalUnitPrice(tabela, promotion.discountKind, promotion.discountValue);
  if (promocional > tabela) return { kind: "regular", price: tabela };

  return { kind: "unit", price: promocional, referencePrice: tabela, promotion };
}

/**
 * O resumo do combo em poucas palavras, como cabe num selo: "3 por R$ 20,00"
 * (preço do kit, "a cada 3") e "R$ 6,50 pra 3+" ("a partir de 3").
 *
 * No percentual, com o preço do produto em mãos, o selo diz o PREÇO por unidade
 * — "R$ 6,30 pra 3+" é o que o cliente entende, "10% off pra 3+" obriga a fazer
 * a conta. Sem o preço (o selo de um grupo com variações de preços diferentes),
 * fica o percentual.
 */
export function describeComboOffer(
  offer: { quantity: number; discountKind: PromotionDiscountKind | null; discountValue: number },
  price?: number,
): string {
  if (offer.discountKind === "kitPrice") {
    return `${offer.quantity} por ${formatCurrency(offer.discountValue)}`;
  }

  if (offer.discountKind === "percentage" && price == null) {
    return `${offer.discountValue.toLocaleString("pt-BR")}% off pra ${offer.quantity}+`;
  }

  const porUnidade =
    offer.discountKind === "percentage"
      ? promotionalUnitPrice(price ?? 0, "percentage", offer.discountValue)
      : round2(offer.discountValue);

  return `${formatCurrency(porUnidade)} pra ${offer.quantity}+`;
}
