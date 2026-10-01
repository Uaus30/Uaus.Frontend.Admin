import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import {
  COUPON_DISCOUNT_TYPE,
  LOYALTY_REWARD_STAGE,
  enumCode,
  getCustomerLoyalty,
  type CouponDiscountTypeCode,
  type CustomerLoyaltyDto,
  type LoyaltyRewardDto,
  type LoyaltySaleOutcomeDto,
} from "@workspace/api-client-react";
import { formatLoyaltyPrize } from "@workspace/core";
import type { ReceiptData } from "@workspace/receipt";
import { useOfflineStore } from "@/stores/use-offline-store";
import { isLoyaltyCoupon, usePdvStore, type AppliedCoupon } from "@/stores/use-pdv-store";

/** O cartão digital que aparece depois da venda, e o que ele precisa para reimprimir. */
export interface LoyaltyResult {
  outcome: LoyaltySaleOutcomeDto;
  customerId: number;
  customerName: string;
  /** O comprovante da venda, para sair de novo com o saldo se o cliente pedir. */
  receipt: ReceiptData;
}

/**
 * O programa de fidelidade no balcão (01/10/2026), num store como o do cupom:
 * o carrinho, o checkout e os diálogos não se enxergam.
 */
export const useLoyaltyStore = create<{
  /** Prêmios que o operador guardou para a próxima compra, nesta venda. */
  savedRewardIds: number[];
  saveReward: (rewardId: number) => void;
  unsaveReward: (rewardId: number) => void;
  resetSaved: () => void;
  /** O resultado da última venda com cliente: abre o cartão digital. */
  lastResult: LoyaltyResult | null;
  setLastResult: (result: LoyaltyResult | null) => void;
  /** O cliente do extrato aberto, ou nulo. */
  statementCustomerId: number | null;
  showStatement: (customerId: number | null) => void;
}>((set) => ({
  savedRewardIds: [],
  saveReward: (rewardId) => set((state) => ({ savedRewardIds: [...state.savedRewardIds, rewardId] })),
  unsaveReward: (rewardId) =>
    set((state) => ({ savedRewardIds: state.savedRewardIds.filter((id) => id !== rewardId) })),
  resetSaved: () => set(() => ({ savedRewardIds: [] })),
  lastResult: null,
  setLastResult: (lastResult) => set(() => ({ lastResult })),
  statementCustomerId: null,
  showStatement: (statementCustomerId) => set(() => ({ statementCustomerId })),
}));

/** Chave do cartão do cliente no PDV; o fim da venda a descarta para a próxima vir fresca. */
export const CUSTOMER_LOYALTY_QUERY_KEY = "pdv-customer-loyalty";

/**
 * O cartão do cliente identificado na venda. Sem internet não há cartão: o
 * carimbo entra quando a venda subir, e o caixa não promete o que não sabe.
 */
export function useCustomerLoyaltyQuery(customerId: number | null) {
  const online = useOfflineStore((state) => state.online);
  return useQuery<CustomerLoyaltyDto>({
    queryKey: [CUSTOMER_LOYALTY_QUERY_KEY, customerId],
    queryFn: () => getCustomerLoyalty(customerId as number),
    enabled: customerId !== null && online,
    staleTime: 0,
    retry: false,
  });
}

/** "R$ 5,00" ou "10%": o prêmio como o cliente ouve. */
export function describeLoyaltyPrize(type: unknown, value: number): string {
  return formatLoyaltyPrize(
    enumCode(type as never, COUPON_DISCOUNT_TYPE) === COUPON_DISCOUNT_TYPE.Percentage,
    value,
  );
}

/**
 * O prêmio como cupom aplicado. A compra mínima do prêmio vira a do cupom: abaixo
 * dela ele fica suspenso no carrinho, como qualquer cupom com mínimo.
 */
export function rewardToCoupon(reward: LoyaltyRewardDto): AppliedCoupon {
  const final = enumCode(reward.stage, LOYALTY_REWARD_STAGE) === LOYALTY_REWARD_STAGE.Final;
  return {
    couponId: reward.couponId,
    code: reward.couponCode,
    description: final ? "Prêmio do cartão fidelidade completo" : "Prêmio do cartão fidelidade",
    discountType: enumCode(reward.discountType, COUPON_DISCOUNT_TYPE) as CouponDiscountTypeCode,
    discountValue: reward.discountValue,
    minimumPurchaseAmount: reward.minimumPurchase > 0 ? reward.minimumPurchase : null,
    answers: [],
    loyaltyRewardId: reward.id,
  };
}

/**
 * A compra que conta para o carimbo, a mesma base do servidor (total pago mais
 * o prêmio do cartão): subtotal menos o desconto manual e menos o cupom pelo
 * código. O prêmio do cartão não tira o carimbo — a compra que troca os R$ 5
 * também carimba —, mas o cupom do panfleto é desconto da compra.
 */
export function loyaltyStampBase(
  subtotal: number,
  globalDiscount: number,
  couponDiscount: number,
  coupon: AppliedCoupon | null,
): number {
  const codeCouponDiscount = coupon && !isLoyaltyCoupon(coupon) ? couponDiscount : 0;
  return Math.round((subtotal - globalDiscount - codeCouponDiscount) * 100) / 100;
}

/**
 * O prêmio que entra sozinho: o primeiro trocável (o que vence antes) que o
 * operador não guardou. Nulo com o programa desligado ou sem prêmio.
 */
export function pickReward(status: CustomerLoyaltyDto | undefined, saved: number[]): LoyaltyRewardDto | null {
  if (!status?.programActive) return null;
  return status.availableRewards.find((reward) => !reward.expired && !saved.includes(reward.id)) ?? null;
}

/**
 * Mantém o prêmio do cartão no carrinho em dia com o cliente da venda. Montado
 * uma vez (em `PdvDialogs`).
 *
 * - Cliente identificado, programa ligado e nenhum cupom pelo código: o prêmio
 *   entra sozinho. Um cupom pelo código já aplicado fica — um cupom por venda —
 *   e o prêmio continua guardado.
 * - Cliente trocado ou tirado: o prêmio do cliente anterior sai do carrinho.
 * - Reedição de venda não aplica prêmio: ela regrava uma venda que já aconteceu.
 */
export function useLoyaltySync() {
  const customerId = usePdvStore((state) => state.consumer.customerId);
  const { data } = useCustomerLoyaltyQuery(customerId);
  const savedRewardIds = useLoyaltyStore((state) => state.savedRewardIds);

  // Cliente TROCADO na venda: os "guardar para a próxima" e o prêmio eram do
  // anterior. Na montagem não: a venda restaurada (F5, venda em espera) volta
  // com o prêmio do próprio cliente, e sem internet ele não teria como voltar.
  const previousCustomerId = useRef(customerId);
  useEffect(() => {
    if (previousCustomerId.current === customerId) return;
    previousCustomerId.current = customerId;
    useLoyaltyStore.getState().resetSaved();
    const { coupon, removeCoupon } = usePdvStore.getState();
    if (isLoyaltyCoupon(coupon)) removeCoupon();
  }, [customerId]);

  useEffect(() => {
    if (!data || data.customerId !== customerId) return;
    const { coupon, editingSaleId, applyCoupon, removeCoupon } = usePdvStore.getState();
    if (editingSaleId !== null) return;

    // O prêmio no carrinho que não está mais entre os trocáveis (trocado em
    // outro caixa, cancelado, programa desligado) sai.
    const stillValid =
      data.programActive && data.availableRewards.some((r) => r.id === coupon?.loyaltyRewardId);
    if (isLoyaltyCoupon(coupon) && (!stillValid || savedRewardIds.includes(coupon!.loyaltyRewardId!))) {
      removeCoupon();
    }

    const current = usePdvStore.getState().coupon;
    if (current) return;

    const reward = pickReward(data, savedRewardIds);
    if (reward) applyCoupon(rewardToCoupon(reward));
  }, [data, customerId, savedRewardIds]);
}
