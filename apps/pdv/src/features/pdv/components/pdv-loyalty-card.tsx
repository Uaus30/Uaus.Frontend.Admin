import { Gift, Star, Stamp } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatCurrency, stampProgress } from "@workspace/core";
import { isLoyaltyCoupon, usePdvStore } from "@/stores/use-pdv-store";
import {
  describeLoyaltyPrize,
  loyaltyStampBase,
  pickReward,
  rewardToCoupon,
  useCustomerLoyaltyQuery,
  useLoyaltyStore,
} from "../hooks/use-loyalty";

/** Ver `keepFocusOnSearch` em `pdv-cart-actions.tsx`: o foco não sai da busca de produto. */
const keepFocusOnSearch = (event: { preventDefault: () => void }) => event.preventDefault();

/**
 * O programa de fidelidade no carrinho (01/10/2026), em três cores:
 *
 * - **azul**, "Faltam R$ 3,50 para esta compra ganhar um carimbo": a deixa para
 *   oferecer mais um item quando a compra está perto do mínimo;
 * - **dourado**, "Esta compra vai ganhar 1 carimbo";
 * - **verde**, o prêmio aplicado, com "Guardar para a próxima".
 *
 * O mínimo conta a compra antes do prêmio — subtotal menos o desconto manual e
 * menos o cupom pelo código, a mesma base do servidor (`loyaltyStampBase`): a
 * compra que troca os R$ 5 também carimba. Só aparece com cliente identificado,
 * internet e o programa ligado.
 */
export function PdvLoyaltyCard() {
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
  const useReward = () => {
    if (!offeredReward) return;
    if (savedRewardIds.includes(offeredReward.id)) unsaveReward(offeredReward.id);
    else applyCoupon(rewardToCoupon(offeredReward));
  };

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Stamp className="h-3.5 w-3.5" /> Cartão fidelidade
        {required ? ` · ${stamps} de ${required} carimbos` : " · cartão novo"}
      </p>

      {prizeApplied && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Gift className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate font-semibold">
              Prêmio de {describeLoyaltyPrize(prizeApplied.discountType, prizeApplied.discountValue)}{" "}
              {couponDiscount > 0 ? `− ${formatCurrency(couponDiscount)}` : "(abaixo do mínimo)"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            onMouseDown={keepFocusOnSearch}
            onClick={() => saveReward(prizeApplied.loyaltyRewardId!)}
          >
            Guardar para a próxima
          </Button>
        </div>
      )}

      {offeredReward && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1.5 border-emerald-500/40 text-[11px]"
          onMouseDown={keepFocusOnSearch}
          onClick={useReward}
        >
          <Gift className="h-3.5 w-3.5" /> Usar o prêmio de{" "}
          {describeLoyaltyPrize(offeredReward.discountType, offeredReward.discountValue)}
        </Button>
      )}

      {hasItems &&
        (progress.earnsStamp ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-400/15 px-2.5 py-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Star className="h-4 w-4 shrink-0 fill-current" /> Esta compra vai ganhar 1 carimbo
          </div>
        ) : (
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-sm text-sky-800 dark:text-sky-300">
            Faltam <strong>{formatCurrency(progress.missing)}</strong> para esta compra ganhar um carimbo
          </div>
        ))}
    </div>
  );
}
