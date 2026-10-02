import { formatCurrency, stampProgress } from "@workspace/core";
import { isLoyaltyCoupon, usePdvStore } from "@/stores/use-pdv-store";
import {
  describeLoyaltyPrize,
  loyaltyStampBase,
  pickReward,
  rewardToCoupon,
  useCustomerLoyaltyQuery,
  useLoyaltyStore,
} from "./use-loyalty";

/**
 * O estado do programa de fidelidade no carrinho, para o card estendido
 * (`pdv-loyalty-card.tsx`) e a linha do carrinho compacto
 * (`pdv-cart-customer-compact.tsx`) contarem a mesma coisa.
 *
 * O mínimo conta a compra antes do prêmio — subtotal menos o desconto manual e
 * menos o cupom pelo código, a mesma base do servidor (`loyaltyStampBase`): a
 * compra que troca os R$ 5 também carimba.
 *
 * @returns `null` sem cliente com cadastro, sem internet ou com o programa
 *   desligado — os casos em que o carrinho não fala do programa.
 */
export function useLoyaltyCard() {
  const customerId = usePdvStore((state) => state.consumer.customerId);
  const hasItems = usePdvStore((state) => state.items.length > 0);
  const coupon = usePdvStore((state) => state.coupon);
  const subtotal = usePdvStore((state) => state.getSubtotal());
  const globalDiscount = usePdvStore((state) => state.globalDiscount);
  const couponDiscount = usePdvStore((state) => state.getCouponDiscount());
  const applyCoupon = usePdvStore((state) => state.applyCoupon);
  const { saveReward, unsaveReward, savedRewardIds } = useLoyaltyStore();
  const { data } = useCustomerLoyaltyQuery(customerId);

  if (!customerId || !data?.programActive) return null;

  const stamps = data.card?.stamps ?? 0;
  const required = data.card?.stampsRequired;
  const prizeApplied = isLoyaltyCoupon(coupon) ? coupon : null;
  const progress = stampProgress(
    loyaltyStampBase(subtotal, globalDiscount, couponDiscount, coupon),
    data.minimumPurchaseForStamp,
  );

  // O prêmio que pode voltar para a venda: o guardado, ou o tirado pelo X do
  // cupom (o automático não reaplica sozinho depois disso).
  const offeredReward = coupon ? null : pickReward(data, []);

  return {
    hasItems,
    stamps,
    required,
    /** "7 de 10 carimbos", ou "cartão novo" antes do primeiro. */
    cardLabel: required ? `${stamps} de ${required} carimbos` : "cartão novo",
    earnsStamp: progress.earnsStamp,
    /** O que falta para o carimbo, já em reais. */
    missing: formatCurrency(progress.missing),
    prizeApplied,
    /** O prêmio aplicado vale agora (zero: abaixo da compra mínima do prêmio). */
    couponDiscount,
    appliedLabel: prizeApplied
      ? describeLoyaltyPrize(prizeApplied.discountType, prizeApplied.discountValue)
      : "",
    offeredReward,
    offeredLabel: offeredReward
      ? describeLoyaltyPrize(offeredReward.discountType, offeredReward.discountValue)
      : "",
    /** Tira o prêmio desta venda e o guarda para a próxima. */
    save: () => {
      if (prizeApplied?.loyaltyRewardId) saveReward(prizeApplied.loyaltyRewardId);
    },
    /** Devolve à venda o prêmio guardado ou tirado. */
    useReward: () => {
      if (!offeredReward) return;
      if (savedRewardIds.includes(offeredReward.id)) unsaveReward(offeredReward.id);
      else applyCoupon(rewardToCoupon(offeredReward));
    },
  };
}
