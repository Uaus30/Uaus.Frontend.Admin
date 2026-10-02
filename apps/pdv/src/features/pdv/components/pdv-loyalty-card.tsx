import { Gift, Star, Stamp } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { useLoyaltyCard } from "../hooks/use-loyalty-card";

/** Ver `keepFocusOnSearch` em `pdv-cart-actions.tsx`: o foco não sai da busca de produto. */
const keepFocusOnSearch = (event: { preventDefault: () => void }) => event.preventDefault();

/**
 * O programa de fidelidade no carrinho ESTENDIDO (01/10/2026), em três cores:
 *
 * - **azul**, "Faltam R$ 3,50 para esta compra ganhar um carimbo": a deixa para
 *   oferecer mais um item quando a compra está perto do mínimo;
 * - **dourado**, "Esta compra vai ganhar 1 carimbo";
 * - **verde**, o prêmio aplicado, com "Guardar para a próxima".
 *
 * Só aparece com cliente identificado, internet e o programa ligado. No carrinho
 * compacto, cliente e programa vão numa linha só (`pdv-cart-customer-compact.tsx`).
 */
export function PdvLoyaltyCard() {
  const loyalty = useLoyaltyCard();
  if (!loyalty) return null;

  const { prizeApplied, offeredReward } = loyalty;

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Stamp className="h-3.5 w-3.5" /> Cartão fidelidade · {loyalty.cardLabel}
      </p>

      {prizeApplied && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Gift className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate font-semibold">
              Prêmio de {loyalty.appliedLabel}{" "}
              {loyalty.couponDiscount > 0
                ? `− ${formatCurrency(loyalty.couponDiscount)}`
                : "(abaixo do mínimo)"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            onMouseDown={keepFocusOnSearch}
            onClick={loyalty.save}
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
          onClick={loyalty.useReward}
        >
          <Gift className="h-3.5 w-3.5" /> Usar o prêmio de {loyalty.offeredLabel}
        </Button>
      )}

      {loyalty.hasItems &&
        (loyalty.earnsStamp ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-400/15 px-2.5 py-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <Star className="h-4 w-4 shrink-0 fill-current" /> Esta compra vai ganhar 1 carimbo
          </div>
        ) : (
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-sm text-sky-800 dark:text-sky-300">
            Faltam <strong>{loyalty.missing}</strong> para esta compra ganhar um carimbo
          </div>
        ))}
    </div>
  );
}
