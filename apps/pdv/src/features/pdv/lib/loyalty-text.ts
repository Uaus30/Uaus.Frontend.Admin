import {
  LOYALTY_REWARD_STAGE,
  LOYALTY_REWARD_STATUS,
  enumCode,
  type LoyaltyRewardDto,
} from "@workspace/api-client-react";
import { formatShortDate } from "@workspace/core";
import { describeLoyaltyPrize } from "../hooks/use-loyalty";

/** "1º prêmio (R$ 5,00): trocado em 21/12/2026" — o prêmio como o extrato o conta. */
export function describeReward(
  reward: LoyaltyRewardDto,
  middleStamp?: number | null,
  stampsRequired?: number,
): string {
  const final = enumCode(reward.stage, LOYALTY_REWARD_STAGE) === LOYALTY_REWARD_STAGE.Final;
  const at = final ? stampsRequired : middleStamp;
  const name = `Prêmio${at ? ` do ${at}º carimbo` : ""} (${describeLoyaltyPrize(reward.discountType, reward.discountValue)})`;
  const status = enumCode(reward.status, LOYALTY_REWARD_STATUS);

  if (status === LOYALTY_REWARD_STATUS.Redeemed && reward.redeemedAt)
    return `${name}: trocado em ${formatShortDate(reward.redeemedAt)}`;
  if (reward.expired) return `${name}: venceu em ${formatShortDate(reward.redeemUntil)}`;
  return `${name}: disponível até ${formatShortDate(reward.redeemUntil)}`;
}
