import { formatCurrency, formatPercentage } from "@workspace/core";
import type { PurchaseDerivedTotals as DerivedTotals } from "../lib/purchase-totals";

type PurchaseDerivedTotalsProps = {
  derived: DerivedTotals;
};

/**
 * A faixa de conferência do formulário: unitários e desconto/acréscimo.
 *
 * Tudo aqui é DERIVADO dos totais digitados (`derivePurchaseTotals`) e nada é
 * gravado — o backend recalcula pela mesma fórmula na leitura, então a tela e o
 * banco não têm como divergir.
 *
 * A cor segue o vocabulário da loja: verde é desconto (economizou), âmbar é
 * acréscimo (frete, imposto). Nunca sozinha — o rótulo ao lado já diz qual é.
 */
export function PurchaseDerivedTotals({ derived }: PurchaseDerivedTotalsProps) {
  const adjustmentTone =
    derived.adjustmentPercent < 0
      ? "text-emerald-600"
      : derived.adjustmentPercent > 0
        ? "text-amber-600"
        : "text-foreground";

  return (
    <div
      data-testid="purchase-derived"
      className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
    >
      <span>
        Unitário bruto:{" "}
        <span className="font-semibold text-foreground">{formatCurrency(derived.unitGross)}</span>
      </span>
      <span>
        Unitário final:{" "}
        <span className="font-semibold text-foreground">{formatCurrency(derived.unitFinal)}</span>
      </span>
      <span>
        {derived.adjustmentPercent < 0 ? "Desconto" : "Acréscimo"}:{" "}
        <span className={`font-semibold ${adjustmentTone}`}>
          {formatPercentage(Math.abs(derived.adjustmentPercent))}
        </span>
      </span>
    </div>
  );
}
