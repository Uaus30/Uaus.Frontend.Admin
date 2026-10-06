import React from "react";
import { AlertTriangle, PackageX, Timer, TrendingDown } from "lucide-react";
import { cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { RestockSuggestion, RestockUrgency } from "../types";

/**
 * Vocabulário das faixas de urgência.
 *
 * Cada faixa vem com ícone e texto além da cor: quem não distingue vermelho de
 * âmbar precisa continuar lendo a lista.
 */
const URGENCY: Record<
  RestockUrgency,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  out: { label: "Sem estoque", className: "bg-destructive/15 text-destructive", icon: PackageX },
  critical: { label: "Crítico", className: "bg-destructive/15 text-destructive", icon: AlertTriangle },
  high: { label: "Alto", className: "bg-amber-500/15 text-amber-300", icon: TrendingDown },
  watch: { label: "Atenção", className: "bg-sky-500/15 text-sky-300", icon: Timer },
};

function UrgencyBadge({ urgency }: { urgency: RestockUrgency }) {
  const config = URGENCY[urgency] ?? URGENCY.watch;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

/** Cobertura restante em linguagem de prateleira. */
function formatCoverage(days: number | null) {
  if (days === null) return "—";
  if (days < 1) return "menos de 1 dia";
  return `${days.toFixed(1).replace(".", ",")} dias`;
}

type RestockListProps = {
  items: RestockSuggestion[];
  lookbackDays: number;
};

/**
 * RestockList
 *
 * Produtos a repor, ordenados pelo lucro que a falta custaria.
 *
 * A ordenação não é por "estoque mais baixo": uma lista assim mistura o campeão
 * de vendas com o item encalhado que também está com uma unidade. A nota que
 * ordena é o lucro por dia do produto multiplicado pelos dias em que ele ficaria
 * em falta — o que transforma "está acabando" em "vai custar tanto".
 */
export function RestockList({ items, lookbackDays }: RestockListProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border/60">
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          Nenhum produto com giro relevante está perto da ruptura nos últimos {lookbackDays} dias.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      {/* Abaixo do `lg`, sem largura mínima: ficam o produto (com o resumo
          embaixo) e o "Comprar" — que era a última de oito colunas rolando de
          lado no celular. */}
      <table className="w-full text-left text-sm lg:min-w-[720px]">
        <thead>
          <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 pb-2 font-medium">Produto</th>
            <th className="hidden lg:table-cell px-2 pb-2 font-medium">Urgência</th>
            <th className="hidden lg:table-cell px-2 pb-2 text-right font-medium">Estoque</th>
            <th className="hidden lg:table-cell px-2 pb-2 text-right font-medium">Cobertura</th>
            <th className="hidden lg:table-cell px-2 pb-2 text-right font-medium">Venda/dia</th>
            <th className="hidden lg:table-cell px-2 pb-2 text-right font-medium">Margem</th>
            <th className="hidden lg:table-cell px-2 pb-2 text-right font-medium">Lucro em risco</th>
            <th className="px-2 pb-2 text-right font-medium">Comprar</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.productId}
              className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
            >
              <td className="px-2 py-3 lg:max-w-[240px]">
                <p className="break-words font-medium text-foreground lg:truncate" title={item.productName}>
                  {item.productName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.categoryName}
                  {item.supplierName && ` · ${item.supplierName}`}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted-foreground lg:hidden">
                  <UrgencyBadge urgency={item.urgency} />
                  <span>
                    estoque {item.stock}
                    {item.minStock > 0 && ` / ${item.minStock}`}
                  </span>
                  <span>· dura {formatCoverage(item.daysOfCover)}</span>
                  <span>· {item.averageDailySales.toFixed(2).replace(".", ",")} por dia</span>
                  <span>· margem {item.marginPercentage.toFixed(1).replace(".", ",")}%</span>
                  <span>· {formatCurrency(item.score)} em risco</span>
                </div>
              </td>
              <td className="hidden lg:table-cell px-2 py-3">
                <UrgencyBadge urgency={item.urgency} />
              </td>
              <td className="hidden lg:table-cell px-2 py-3 text-right tabular-nums">
                {item.stock}
                {item.minStock > 0 && (
                  <span className="text-xs text-muted-foreground"> / {item.minStock}</span>
                )}
              </td>
              <td className="hidden lg:table-cell px-2 py-3 text-right tabular-nums text-muted-foreground">
                {formatCoverage(item.daysOfCover)}
              </td>
              <td className="hidden lg:table-cell px-2 py-3 text-right tabular-nums text-muted-foreground">
                {item.averageDailySales.toFixed(2).replace(".", ",")}
              </td>
              <td className="hidden lg:table-cell px-2 py-3 text-right tabular-nums text-muted-foreground">
                {item.marginPercentage.toFixed(1).replace(".", ",")}%
              </td>
              <td className="hidden lg:table-cell px-2 py-3 text-right font-medium tabular-nums text-foreground">
                {formatCurrency(item.score)}
              </td>
              <td className="px-2 py-3 text-right">
                <span className="inline-flex rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                  {item.suggestedPurchaseQuantity} un
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
