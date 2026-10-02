import { describe, expect, it } from "vitest";
import type { LoyaltySaleOutcomeDto } from "@workspace/api-client-react";
import { describeLoyaltyResult } from "../loyalty-result";

const card = (stamps: number, nextRewardAt = 5) => ({
  id: 1,
  stamps,
  stampsRequired: 10,
  middleStamp: 5,
  openedAt: "2026-10-01T10:00:00",
  expiresAt: "2027-10-01T23:59:59",
  status: "Open",
  nextRewardAt,
  nextRewardType: "Amount",
  nextRewardValue: 5,
});

const outcome = (overrides: Partial<LoyaltySaleOutcomeDto>): LoyaltySaleOutcomeDto => ({
  stamped: true,
  minimumPurchaseForStamp: 10,
  cardCompleted: false,
  unlockedRewards: [],
  ...overrides,
});

describe("describeLoyaltyResult", () => {
  it("na compra comum, destaca a casa do carimbo novo", () => {
    const { rows, earnedCount } = describeLoyaltyResult(outcome({ stampNumber: 3, card: card(3) }));

    expect(rows).toHaveLength(1);
    expect([...rows[0].earnedNow]).toEqual([3]);
    expect(rows[0].slots.filter((slot) => slot.filled).map((slot) => slot.number)).toEqual([1, 2, 3]);
    expect(earnedCount).toBe(1);
  });

  it("na compra que completa o cartão, são dois carimbos de uma vez: o 10º e o extra do novo", () => {
    const { rows, earnedCount } = describeLoyaltyResult(
      outcome({ stampNumber: 10, cardCompleted: true, card: card(1) }),
    );

    expect(rows.map((row) => row.label)).toEqual(["Cartão completo", "Cartão novo"]);
    expect([...rows[0].earnedNow]).toEqual([10]);
    expect(rows[0].slots.every((slot) => slot.filled)).toBe(true);
    expect([...rows[1].earnedNow]).toEqual([1]);
    expect(earnedCount).toBe(2);
  });

  it("compra que não carimbou não destaca nada", () => {
    const { rows, earnedCount } = describeLoyaltyResult(
      outcome({ stamped: false, reason: "abaixo do mínimo", card: card(2) }),
    );

    expect(rows[0].earnedNow.size).toBe(0);
    expect(earnedCount).toBe(0);
  });

  it("sem cartão, nada a desenhar", () => {
    expect(describeLoyaltyResult(outcome({ stamped: false }))).toEqual({ rows: [], earnedCount: 0 });
  });
});
