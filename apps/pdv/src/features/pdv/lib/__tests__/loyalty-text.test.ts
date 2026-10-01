import { describe, expect, it } from "vitest";
import type { LoyaltyRewardDto } from "@workspace/api-client-react";
import { describeLoyaltyPrize, pickReward, rewardToCoupon } from "../../hooks/use-loyalty";
import { describeReward, toStampLine } from "../loyalty-text";

const reward = (overrides: Partial<LoyaltyRewardDto> = {}): LoyaltyRewardDto => ({
  id: 9,
  stage: "Middle",
  couponId: 10,
  couponCode: "FIDELIDADE5",
  discountType: "Amount",
  discountValue: 5,
  minimumPurchase: 10,
  unlockedAt: "2026-11-07T10:00:00",
  redeemUntil: "2027-12-03T23:59:59",
  status: "Available",
  redeemedAt: null,
  expired: false,
  ...overrides,
});

describe("o prêmio no extrato e no carrinho", () => {
  it("escreve o prêmio como o cliente ouve", () => {
    expect(describeLoyaltyPrize("Amount", 5)).toMatch(/R\$\s5,00/);
    expect(describeLoyaltyPrize("Percentage", 10)).toBe("10%");
  });

  it("conta no extrato se foi trocado, se venceu ou até quando vale", () => {
    expect(describeReward(reward({ status: "Redeemed", redeemedAt: "2026-12-21T10:00:00" }), 5, 10)).toMatch(
      /Prêmio do 5º carimbo \(R\$\s5,00\): trocado em 21\/12\/2026/,
    );
    expect(describeReward(reward({ stage: "Final" }), 5, 10)).toMatch(
      /do 10º carimbo.*disponível até 03\/12\/2027/,
    );
    expect(describeReward(reward({ expired: true }), 5, 10)).toContain("venceu em 03/12/2027");
  });

  it("vira cupom com o canal do cartão e a compra mínima do prêmio", () => {
    expect(rewardToCoupon(reward())).toMatchObject({
      couponId: 10,
      code: "FIDELIDADE5",
      discountType: 2,
      discountValue: 5,
      minimumPurchaseAmount: 10,
      loyaltyRewardId: 9,
      answers: [],
    });
  });

  it("aplica o que vence antes, pula o guardado e não aplica com o programa desligado", () => {
    const status = {
      customerId: 1,
      programActive: true,
      minimumPurchaseForStamp: 10,
      availableRewards: [reward({ id: 1 }), reward({ id: 2, stage: "Final" })],
    };

    expect(pickReward(status, [])?.id).toBe(1);
    expect(pickReward(status, [1])?.id).toBe(2);
    expect(pickReward({ ...status, programActive: false }, [])).toBeNull();
  });
});

describe("a linha do extrato", () => {
  it("leva quantos carimbos o ajuste deu ou tirou, e o motivo", () => {
    expect(
      toStampLine({
        position: 4,
        points: -1,
        occurredAt: "2026-10-03T10:00:00",
        kind: "Adjustment",
        reason: "Estorno",
      }),
    ).toEqual({
      position: 4,
      points: -1,
      occurredAt: "2026-10-03T10:00:00",
      bonus: false,
      adjustment: true,
      reason: "Estorno",
    });
    expect(
      toStampLine({ position: 1, points: 1, occurredAt: "2026-10-01T10:00:00", kind: "Bonus" }),
    ).toMatchObject({
      bonus: true,
      adjustment: false,
    });
  });
});
