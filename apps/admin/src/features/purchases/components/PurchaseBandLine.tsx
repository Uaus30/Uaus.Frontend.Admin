import { Lock } from "lucide-react";
import { cn } from "@workspace/ui";
import { monthNameOf } from "@workspace/core";
import { PURCHASE_BAND_LOOK, monthInSentence, purchaseRooms } from "@/lib/purchase-band";
import type { PurchaseBandImpact } from "../lib/purchase-band-impact";

interface PurchaseBandLineProps {
  impact: PurchaseBandImpact | null;
}

/**
 * A linha da faixa de compras no editor da compra (seção 7.3 do plano):
 * "Esta compra mantém novembro no verde", "leva novembro para o amarelo" ou
 * "para o vermelho", com o que sobra depois dela.
 *
 * Aparece só quando a compra passa a valer dinheiro ou muda o quanto vale —
 * quem decide é `purchaseBandImpact`. Compra com data em mês já fechado não
 * mostra faixa: ela conta no mês da data, mas não muda o fechamento, e o
 * dinheiro dela aparece como diferença de saldo no próximo.
 */
export function PurchaseBandLine({ impact }: PurchaseBandLineProps) {
  if (!impact) return null;

  if (impact.closedMonth) {
    return (
      <p
        data-testid="purchase-band-line"
        className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground"
      >
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {monthNameOf(impact.monthKey)} já foi fechado: esta compra conta no mês da data, mas não muda o
          fechamento — o dinheiro dela vai aparecer como diferença no saldo.
        </span>
      </p>
    );
  }

  const look = PURCHASE_BAND_LOOK[impact.after];
  const Icon = look.icon;
  const month = monthInSentence(impact.monthKey);
  const verb = impact.after === impact.before ? `mantém ${month} no` : `leva ${month} para o`;
  const { parts, backToGreen } = purchaseRooms(impact.after, impact.greenRoomAfter, impact.redRoomAfter);

  return (
    <div
      data-testid="purchase-band-line"
      data-band={impact.after}
      className={cn("rounded-lg border px-3.5 py-3 text-sm", look.panelClass)}
    >
      <p className={cn("flex items-center gap-2 font-semibold", look.textClass)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        Esta compra {verb} {look.name}
      </p>
      {parts.length > 0 && <p className="mt-1 text-xs text-foreground">Depois dela: {parts.join(" · ")}</p>}
      {backToGreen && <p className="mt-1 text-xs text-foreground">{backToGreen}</p>}
      {impact.provisional && (
        <p className="mt-1 text-xs text-muted-foreground">
          Faixa provisória: o saldo do mês anterior ainda não entrou na conta.
        </p>
      )}
    </div>
  );
}
