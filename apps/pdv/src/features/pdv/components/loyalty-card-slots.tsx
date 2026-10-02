import { Check, Gift, Star } from "lucide-react";
import type { CardSlot } from "@workspace/core";
import { cn } from "@workspace/ui";

type LoyaltyCardSlotsProps = {
  slots: CardSlot[];
  /** As casas ganhas nesta venda: viram a estrela dourada com brilho. */
  earnedNow: ReadonlySet<number>;
  /** Rótulo do trecho ("Cartão completo", "Cartão novo"), quando há mais de um. */
  label?: string;
};

/**
 * As casas do cartão digital (pedido do dono, 01/10/2026): carimbada é um
 * "certo" dourado; a ganha AGORA é uma estrela dourada com brilho, para o
 * operador e o cliente verem o que esta compra rendeu; vazia mostra o número, e
 * a do prêmio, o presente.
 *
 * Até 5 casas por fileira, como o cartão de papel: o cartão de 10 sem trecho
 * (sem prêmio do meio, ou com ele já liberado) vira duas fileiras em vez de dez
 * casas espremidas em elipse.
 */
export function LoyaltyCardSlots({ slots, earnedNow, label }: LoyaltyCardSlotsProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      )}
      <ul className="mx-auto flex max-w-[18rem] flex-wrap justify-center gap-2">
        {slots.map((slot) => {
          const earned = earnedNow.has(slot.number);
          return (
            <li
              key={slot.number}
              aria-label={`${slot.number}º carimbo${earned ? ": ganho agora" : slot.filled ? ": carimbado" : slot.prize ? ": prêmio" : ""}`}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold",
                earned
                  ? "border-amber-400 bg-amber-400/20 shadow-[0_0_16px_4px_rgba(251,191,36,0.55)]"
                  : slot.filled
                    ? "border-amber-400/70 bg-amber-400/10"
                    : "border-dashed border-border text-muted-foreground",
              )}
            >
              {earned ? (
                <Star
                  aria-hidden
                  className="h-7 w-7 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)] motion-safe:animate-pulse"
                />
              ) : slot.filled ? (
                <Check aria-hidden strokeWidth={3} className="h-6 w-6 text-amber-500" />
              ) : slot.prize ? (
                <Gift aria-hidden className="h-5 w-5" />
              ) : (
                slot.number
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
