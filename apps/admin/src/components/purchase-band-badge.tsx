import type { PurchaseBand } from "@workspace/core";
import { cn } from "@workspace/ui";
import { PURCHASE_BAND_LOOK } from "@/lib/purchase-band";

interface PurchaseBandBadgeProps {
  band: PurchaseBand;
  className?: string;
}

/**
 * A faixa de compras como rótulo: ícone e palavra na cor da faixa.
 *
 * Um componente só para o Painel, a listagem e o editor de Compras e o
 * Dashboard — cor sozinha não informa, e o ícone e a palavra precisam andar
 * juntos com ela em toda tela, não em algumas.
 */
export function PurchaseBandBadge({ band, className }: PurchaseBandBadgeProps) {
  const look = PURCHASE_BAND_LOOK[band];
  const Icon = look.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", look.textClass, className)}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {look.label}
    </span>
  );
}
