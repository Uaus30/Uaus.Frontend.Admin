import { Gift, Star, Stamp } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatCurrency, stampProgress } from "@workspace/core";
import { Hint } from "@/components/hint";
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
 *
 * No carrinho compacto (o padrão), tudo vai numa linha só. O monitor do caixa
 * da loja é HD: medido em 1366×768, as três linhas do layout estendido tiravam
 * 104px da lista de itens — com cliente e prêmio, a lista caía de 377px para
 * 226px, uns dois itens à vista (01/10/2026).
 */
export function PdvLoyaltyCard() {
  const customerId = usePdvStore((state) => state.consumer.customerId);
  const hasItems = usePdvStore((state) => state.items.length > 0);
  const coupon = usePdvStore((state) => state.coupon);
  const subtotal = usePdvStore((state) => state.getSubtotal());
  const globalDiscount = usePdvStore((state) => state.globalDiscount);
  const couponDiscount = usePdvStore((state) => state.getCouponDiscount());
  const applyCoupon = usePdvStore((state) => state.applyCoupon);
  const compact = usePdvStore((state) => state.cartLayout) === "compact";
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

  const cardLabel = required ? `${stamps} de ${required} carimbos` : "cartão novo";
  const appliedLabel = prizeApplied
    ? describeLoyaltyPrize(prizeApplied.discountType, prizeApplied.discountValue)
    : "";
  const offeredLabel = offeredReward
    ? describeLoyaltyPrize(offeredReward.discountType, offeredReward.discountValue)
    : "";
  const missing = formatCurrency(progress.missing);
  const save = () => prizeApplied && saveReward(prizeApplied.loyaltyRewardId!);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Hint label={`Cartão fidelidade: ${cardLabel}`}>
          <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-muted-foreground">
            <Stamp className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Cartão fidelidade: </span>
            {required ? `${stamps}/${required}` : "Novo"}
          </span>
        </Hint>

        {hasItems &&
          (progress.earnsStamp ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-400/15 px-2 py-1 font-semibold text-amber-800 dark:text-amber-300">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              <span className="sr-only">Esta compra vai ganhar </span>+1 carimbo
            </span>
          ) : (
            <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-800 dark:text-sky-300">
              Faltam <strong>{missing}</strong> para o carimbo
            </span>
          ))}

        {prizeApplied && (
          // Abaixo do mínimo do prêmio, o chip fica apagado e a explicação vai para a
          // dica: o "(abaixo do mínimo)" escrito quebrava a linha em duas no começo
          // da venda, que é quando ele aparece — e o rodapé já diz quanto falta.
          <Hint
            label={
              couponDiscount > 0 ? null : "Abaixo da compra mínima do prêmio: entra quando a compra chegar lá"
            }
          >
            <span
              className={`ml-auto inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 py-0.5 pl-2 pr-0.5 font-semibold ${couponDiscount > 0 ? "" : "opacity-60"}`}
            >
              <Gift className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Prêmio {appliedLabel}
              <Button
                aria-label="Guardar para a próxima"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px]"
                onMouseDown={keepFocusOnSearch}
                onClick={save}
              >
                Guardar
              </Button>
            </span>
          </Hint>
        )}

        {offeredReward && (
          <Button
            aria-label={`Usar o prêmio de ${offeredLabel}`}
            variant="outline"
            size="sm"
            className="ml-auto h-7 gap-1 border-emerald-500/40 px-2 text-[11px]"
            onMouseDown={keepFocusOnSearch}
            onClick={useReward}
          >
            <Gift className="h-3.5 w-3.5" aria-hidden /> Usar {offeredLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Stamp className="h-3.5 w-3.5" /> Cartão fidelidade · {cardLabel}
      </p>

      {prizeApplied && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Gift className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate font-semibold">
              Prêmio de {appliedLabel}{" "}
              {couponDiscount > 0 ? `− ${formatCurrency(couponDiscount)}` : "(abaixo do mínimo)"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            onMouseDown={keepFocusOnSearch}
            onClick={save}
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
          <Gift className="h-3.5 w-3.5" /> Usar o prêmio de {offeredLabel}
        </Button>
      )}

      {hasItems &&
        (progress.earnsStamp ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-400/15 px-2.5 py-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Star className="h-4 w-4 shrink-0 fill-current" /> Esta compra vai ganhar 1 carimbo
          </div>
        ) : (
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-sm text-sky-800 dark:text-sky-300">
            Faltam <strong>{missing}</strong> para esta compra ganhar um carimbo
          </div>
        ))}
    </div>
  );
}
