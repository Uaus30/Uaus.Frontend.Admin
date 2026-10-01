import {
  COUPON_DISCOUNT_TYPE,
  LOYALTY_REWARD_STAGE,
  LOYALTY_REWARD_STATUS,
  LOYALTY_STAMP_KIND,
  enumCode,
  type LoyaltyRewardDto,
  type LoyaltyStatementDto,
  type LoyaltyStatementStampDto,
} from "@workspace/api-client-react";
import type { LoyaltyStatementReceipt, StatementStampLine, StoreInfo } from "@workspace/receipt";
import { describeLoyaltyReward } from "@workspace/core";

/** O prêmio como o extrato o conta — o mesmo texto do PDV (`describeLoyaltyReward`). */
export function rewardLine(
  reward: LoyaltyRewardDto,
  middleStamp?: number | null,
  stampsRequired?: number,
): string {
  const redeemed = enumCode(reward.status, LOYALTY_REWARD_STATUS) === LOYALTY_REWARD_STATUS.Redeemed;
  return describeLoyaltyReward(
    {
      final: enumCode(reward.stage, LOYALTY_REWARD_STAGE) === LOYALTY_REWARD_STAGE.Final,
      percentage: enumCode(reward.discountType, COUPON_DISCOUNT_TYPE) === COUPON_DISCOUNT_TYPE.Percentage,
      discountValue: reward.discountValue,
      redeemedAt: redeemed ? reward.redeemedAt : null,
      expired: reward.expired,
      redeemUntil: reward.redeemUntil,
    },
    middleStamp,
    stampsRequired,
  );
}

/** A linha do extrato como a tela e o papel a escrevem (`describeLoyaltyStamp`). */
export function toStampLine(stamp: LoyaltyStatementStampDto): StatementStampLine {
  const kind = enumCode(stamp.kind, LOYALTY_STAMP_KIND);
  return {
    position: stamp.position,
    points: stamp.points,
    occurredAt: stamp.occurredAt,
    bonus: kind === LOYALTY_STAMP_KIND.Bonus,
    adjustment: kind === LOYALTY_STAMP_KIND.Adjustment,
    reason: stamp.reason,
  };
}

/** O extrato no formato da impressora do caixa (`printLoyaltyStatement`). */
export function toStatementReceipt(
  statement: LoyaltyStatementDto,
  store: StoreInfo | undefined,
): LoyaltyStatementReceipt {
  const card = statement.card;
  return {
    customerName: statement.customerName,
    stamps: statement.stamps.map(toStampLine),
    stampsRequired: card?.stampsRequired ?? 0,
    expiresAt: card?.expiresAt,
    rewardLines: statement.rewards.map((reward) =>
      rewardLine(reward, card?.middleStamp, card?.stampsRequired),
    ),
    printedAt: new Date(),
    store,
  };
}
