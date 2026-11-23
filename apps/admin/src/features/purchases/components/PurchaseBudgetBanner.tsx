import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@workspace/ui";
import { monthNameOf, purchaseBandFor } from "@workspace/core";
import type { PurchaseBudgetDto } from "@workspace/api-client-react";
import {
  PURCHASE_BAND_LOOK,
  plannedNotice,
  provisionalNotice,
  purchaseBandOf,
  purchaseRooms,
} from "@/lib/purchase-band";
import { FINANCIAL_DASHBOARD_PATH } from "@/features/financial-dashboard/financial-dashboard-route";

interface PurchaseBudgetBannerProps {
  /** A faixa do mês corrente; indefinida enquanto carrega (aí a faixa não aparece). */
  budget?: PurchaseBudgetDto;
}

/**
 * A faixa de compras no topo da listagem de Compras, no estilo do
 * `OpenPurchasesAlert`: "Novembro está verde: pode comprar R$ 439,00 no verde,
 * R$ 1.712,00 até o vermelho", com link para o Painel Financeiro.
 *
 * Com pendentes que têm valor, simula: "Se fizer as pendentes (R$ 600,00), o
 * mês vai para amarelo" — Pendente não conta como dinheiro que saiu, mas é a
 * compra que está para acontecer. Provisória, diz que é e qual mês falta fechar.
 *
 * Ao contrário do alerta de compras em aberto, a faixa não some no verde: o
 * verde também é informação ("dá para comprar mais R$ 439").
 */
export function PurchaseBudgetBanner({ budget }: PurchaseBudgetBannerProps) {
  if (!budget) return null;

  const band =
    purchaseBandOf(budget.band) ?? purchaseBandFor(budget.purchasesPaid, budget.greenLimit, budget.redLimit);
  const look = PURCHASE_BAND_LOOK[band];
  const Icon = look.icon;
  const { parts, backToGreen } = purchaseRooms(band, budget.greenRoom, budget.redRoom);
  const planned = plannedNotice(budget);

  return (
    <Link
      href={FINANCIAL_DASHBOARD_PATH}
      data-testid="purchase-budget-banner"
      data-band={band}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm text-foreground transition-colors hover:brightness-110",
        look.panelClass,
      )}
    >
      <span className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", look.textClass)} aria-hidden />
        <span className="space-y-0.5">
          <span className="block">
            <strong className={look.textClass}>
              {monthNameOf(budget.month)} está {look.name}
              {budget.isProvisional && " (provisória)"}
            </strong>
            {parts.length > 0 && `: pode comprar ${parts.join(", ")}`}
            {backToGreen && `. ${backToGreen}`}
          </span>
          {planned && <span className="block text-xs text-muted-foreground">{planned}.</span>}
          {budget.isProvisional && (
            <span className="block text-xs text-muted-foreground">
              Sem o saldo inicial. {provisionalNotice(budget)}.
            </span>
          )}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
