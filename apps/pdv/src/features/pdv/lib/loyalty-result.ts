import type { LoyaltySaleOutcomeDto } from "@workspace/api-client-react";
import { cardSlots, type CardSlot } from "@workspace/core";

/** Um trecho de cartão para desenhar, com as casas ganhas nesta venda. */
export interface LoyaltyResultRow {
  label?: string;
  slots: CardSlot[];
  earnedNow: Set<number>;
}

/**
 * O que o cartão digital desenha depois da venda e quantos carimbos ela rendeu.
 *
 * Na compra comum, um trecho, com a casa do carimbo novo em destaque. Na que
 * COMPLETA o cartão, dois: o cartão que fechou, com o último carimbo em
 * destaque, e o novo, que já nasce com o carimbo extra — são dois carimbos de
 * uma vez (o dono lembrou disso em 01/10/2026), e um trecho só esconderia um
 * deles.
 */
export function describeLoyaltyResult(outcome: LoyaltySaleOutcomeDto): {
  rows: LoyaltyResultRow[];
  earnedCount: number;
} {
  const card = outcome.card;
  if (!card) return { rows: [], earnedCount: 0 };

  if (outcome.cardCompleted) {
    const closedAt = outcome.stampNumber ?? card.stampsRequired;
    const bonus = Array.from({ length: card.stamps }, (_, index) => index + 1);
    return {
      rows: [
        {
          label: "Cartão completo",
          slots: cardSlots(closedAt, closedAt, card.middleStamp),
          earnedNow: new Set(outcome.stamped ? [closedAt] : []),
        },
        {
          label: "Cartão novo",
          slots: cardSlots(card.stamps, card.stampsRequired, card.middleStamp, card.nextRewardAt),
          earnedNow: new Set(bonus),
        },
      ],
      earnedCount: (outcome.stamped ? 1 : 0) + bonus.length,
    };
  }

  const earned = outcome.stamped && outcome.stampNumber ? [outcome.stampNumber] : [];
  return {
    rows: [
      {
        slots: cardSlots(card.stamps, card.stampsRequired, card.middleStamp, card.nextRewardAt),
        earnedNow: new Set(earned),
      },
    ],
    earnedCount: earned.length,
  };
}
