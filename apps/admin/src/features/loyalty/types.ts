/** Os atalhos de período do painel. "Todo o período" é o padrão (pedido do dono). */
export type LoyaltyPeriodPreset = "all" | "this-month" | "last-month" | "90-days";

/**
 * A configuração do programa como o modal a edita: números em texto (o
 * operador digita "10,00") e os tipos de prêmio em código (1 = %, 2 = R$).
 */
export interface LoyaltyConfigForm {
  stampsPerCard: string;
  /** Vazio: cartão só com o prêmio final. */
  middleStamp: string;
  middleDiscountType: number;
  middleDiscountValue: string;
  middleCouponId: string;
  finalDiscountType: number;
  finalDiscountValue: string;
  finalCouponId: string;
  minimumPurchaseForStamp: string;
  /** Vazio: igual ao mínimo do carimbo. */
  rewardMinimumPurchase: string;
  bonusStampsOnNewCard: string;
  cardValidityMonths: string;
  rewardGraceDays: string;
}
