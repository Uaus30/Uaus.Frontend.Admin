import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROMOTION_DISCOUNT_TYPE,
  PROMOTION_TYPE,
  enumCode,
  useGetCurrentPromotions,
  type PdvPromotionDto,
} from "@workspace/api-client-react";
import {
  promotionDiscountKindFromCode,
  promotionKindFromCode,
  resolveShelfPromotion,
  shelfPrice,
  toLocalTimestamp,
  type PromotionRule,
  type ShelfPrice,
} from "@workspace/core";

/**
 * A promoção da API no formato da regra de anúncio do `@workspace/core`. Nula
 * quando a espécie ou o desconto não são conhecidos — não casa com produto
 * nenhum, como no balcão.
 */
export function toPromotionRule(dto: PdvPromotionDto): PromotionRule | null {
  const kind = promotionKindFromCode(enumCode(dto.type, PROMOTION_TYPE));
  const discountKind = promotionDiscountKindFromCode(enumCode(dto.discountType, PROMOTION_DISCOUNT_TYPE));
  if (!kind || !discountKind) return null;

  // No combo o `productGroupId` vem zero e quem diz os grupos é a lista; numa API
  // anterior ao combo a lista falta, e o grupo único é o próprio campo.
  const productGroupIds =
    dto.productGroupIds && dto.productGroupIds.length > 0 ? dto.productGroupIds : [dto.productGroupId];

  return {
    id: dto.id,
    kind,
    discountKind,
    discountValue: dto.discountValue,
    productGroupIds,
    comboQuantity: dto.comboQuantity ?? null,
    validFrom: dto.validFrom,
    validUntil: dto.validUntil ?? null,
    maxQuantityPerSale: dto.maxQuantityPerSale ?? null,
  };
}

/** Resolve o preço de um produto: o grupo dele e o preço de tabela. */
export type ShelfPriceOf = (productGroupId: number | null | undefined, price: number) => ShelfPrice;

/**
 * Teto do timer da próxima virada. Uma virada a dias de distância reagenda a
 * cada hora — `setTimeout` com atraso grande demais dispara na hora (o limite é
 * ~24,8 dias), e o navegador atrasa timer de aba em segundo plano de qualquer jeito.
 */
const MAX_TIMER_MS = 60 * 60 * 1000;

/**
 * Milissegundos até a próxima virada de alguma regra — uma promoção que começa
 * ou acaba depois de `nowMs` —, ou nulo quando nenhuma vira mais.
 *
 * O fim é INCLUSIVO, em segundos: a relâmpago que vai até 18:00:00 ainda vale
 * nesse segundo e deixa de valer em 18:00:01. O início vale no próprio instante.
 * Os instantes vêm no horário local sem fuso, que `new Date` lê como local.
 */
export function msUntilNextBoundary(rules: readonly PromotionRule[], nowMs: number): number | null {
  let proxima = Number.POSITIVE_INFINITY;

  for (const rule of rules) {
    const inicio = new Date(rule.validFrom).getTime();
    const fim = rule.validUntil ? new Date(rule.validUntil).getTime() + 1000 : Number.NaN;

    for (const instante of [inicio, fim]) {
      if (instante > nowMs && instante < proxima) proxima = instante;
    }
  }

  return Number.isFinite(proxima) ? proxima - nowMs : null;
}

/**
 * O preço que o admin mostra para um produto, já com a promoção que vale agora —
 * listagem e detalhe de produtos, etiqueta de gôndola e catálogo.
 *
 * Pedido do dono (05/10/2026): onde o sistema mostra o preço do produto, mostrar
 * o promocional. A conta e a precedência são as do `@workspace/core`, as mesmas
 * do balcão; a lista é a de `useGetCurrentPromotions`, uma consulta para a tela
 * inteira.
 *
 * Enquanto a lista não chega (ou se ela falhar), tudo sai no preço de tabela —
 * que é o que a tela mostrava antes: promoção é enfeite do preço, não
 * pré-requisito de abrir a listagem.
 *
 * @returns Uma função estável enquanto a lista não muda — vai para dentro de
 *   `useMemo` de quem monta linhas.
 */
export function useShelfPrice(): {
  shelfPriceOf: ShelfPriceOf;
  rules: PromotionRule[];
  /** O instante do anúncio — anda nas viradas das regras (ver acima). */
  now: string;
} {
  const { data } = useGetCurrentPromotions();

  const rules = useMemo(
    () => (data ?? []).map(toPromotionRule).filter((rule): rule is PromotionRule => rule !== null),
    [data],
  );

  // O RELÓGIO do anúncio. Sem ele, a resposta só mudaria quando a LISTA mudasse
  // — e a lista do dia inteiro não muda às 18h, quando a relâmpago acaba (o
  // React Query devolve o mesmo `data` para a mesma resposta). A etiqueta montada
  // às 17h e impressa às 18h30 saía com o preço da relâmpago, e a listagem
  // seguia anunciando "por R$ 9,90" (achado da revisão de 05/10/2026).
  //
  // `now` só anda nas viradas das regras (e quando a lista muda, ou a aba volta
  // a ficar visível): entre duas viradas nenhuma promoção muda de estado, e
  // andar a cada segundo só redesenharia a listagem inteira à toa.
  const [now, setNow] = useState(toLocalTimestamp);
  const [rulesAtNow, setRulesAtNow] = useState(rules);
  if (rulesAtNow !== rules) {
    setRulesAtNow(rules);
    setNow(toLocalTimestamp());
  }

  useEffect(() => {
    const atraso = msUntilNextBoundary(rules, Date.now());
    if (atraso == null) return;

    // 50 ms de folga: disparar no milésimo exato da virada leria o segundo anterior.
    const timer = setTimeout(() => setNow(toLocalTimestamp()), Math.min(atraso + 50, MAX_TIMER_MS));
    return () => clearTimeout(timer);
  }, [rules, now]);

  useEffect(() => {
    // Aba em segundo plano tem timer atrasado pelo navegador: ao voltar, o
    // relógio é relido na hora.
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(toLocalTimestamp());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const shelfPriceOf = useCallback<ShelfPriceOf>(
    (productGroupId, price) => shelfPrice(price, resolveShelfPromotion(rules, productGroupId, now)),
    [rules, now],
  );

  return { shelfPriceOf, rules, now };
}
