import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton, cn } from "@workspace/ui";
import { monthNameOf, purchaseBandFor } from "@workspace/core";
import type { PurchaseBudgetDto } from "@workspace/api-client-react";
import { PURCHASE_BAND_LOOK, purchaseBandOf, purchaseRooms } from "@/lib/purchase-band";
import { FINANCIAL_DASHBOARD_PATH } from "@/features/financial-dashboard/financial-dashboard-route";

interface PurchaseBandCardProps {
  budget?: PurchaseBudgetDto;
  isLoading: boolean;
}

/**
 * PurchaseBandCard
 *
 * O cartão pequeno da faixa de compras no Dashboard: a faixa do mês, com cor,
 * ícone e palavra, e o "pode comprar". O toque abre o Painel Financeiro, onde
 * está o resto (seção 7.4 do plano).
 *
 * Falhando a consulta, o cartão some: o Dashboard é a tela de vendas, e um erro
 * do financeiro não pode tomar o lugar dela.
 */
export function PurchaseBandCard({ budget, isLoading }: PurchaseBandCardProps) {
  if (isLoading) return <Skeleton className="h-16 rounded-lg" />;
  if (!budget) return null;

  const band =
    purchaseBandOf(budget.band) ?? purchaseBandFor(budget.purchasesPaid, budget.greenLimit, budget.redLimit);
  const look = PURCHASE_BAND_LOOK[band];
  const Icon = look.icon;
  const { parts, backToGreen } = purchaseRooms(band, budget.greenRoom, budget.redRoom);

  return (
    <Link
      href={FINANCIAL_DASHBOARD_PATH}
      data-testid="purchase-band-card"
      data-band={band}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:brightness-110",
        look.panelClass,
      )}
    >
      <span className="flex min-w-0 items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", look.textClass)} aria-hidden />
        <span className="min-w-0">
          <span className={cn("block font-semibold", look.textClass)}>
            Compras de {monthNameOf(budget.month).toLowerCase()}: {look.name}
            {budget.isProvisional && " (provisória)"}
          </span>
          <span className="block text-foreground">
            {parts.length > 0 ? `Pode comprar ${parts.join(" · ")}` : backToGreen}
          </span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
