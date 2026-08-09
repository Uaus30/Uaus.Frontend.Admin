import React from "react";
import { Skeleton } from "@workspace/ui";
import { formatCurrency } from "@/lib/formatters";
import type { DashboardBreakdown } from "../types";
import { ChartCard, ChartEmptyState } from "./chart-primitives";

type RevenueBreakdownCardProps = {
  title: string;
  description: string;
  items: DashboardBreakdown[];
  isLoading: boolean;
  emptyMessage: string;
  /** Itens exibidos antes de agrupar a cauda em "Outros". */
  limit?: number;
};

/**
 * RevenueBreakdownCard
 *
 * Quebra do faturamento em barras horizontais.
 *
 * Barras em vez de rosca porque a pergunta aqui é "quanto cada um faturou", e
 * comparar comprimentos é mais fácil que comparar ângulos — ainda mais com nomes
 * longos, que numa pizza viram legenda e obrigam a ir e voltar entre a cor e o
 * texto.
 *
 * Todas as barras usam o mesmo matiz: a identidade já está no rótulo ao lado, e
 * colorir cada linha de um jeito gastaria o canal de cor para repetir o que o
 * comprimento da barra e o nome já dizem.
 */
export function RevenueBreakdownCard({
  title,
  description,
  items,
  isLoading,
  emptyMessage,
  limit = 6,
}: RevenueBreakdownCardProps) {
  if (isLoading) {
    return <Skeleton className="h-[360px] rounded-xl" />;
  }

  // A cauda vira uma linha só: mais de meia dúzia de barras deixa de ser leitura
  // e vira lista.
  const visible = items.slice(0, limit);
  const tail = items.slice(limit);
  const rows =
    tail.length > 0
      ? [
          ...visible,
          {
            id: null,
            name: `Outros (${tail.length})`,
            revenue: tail.reduce((sum, item) => sum + item.revenue, 0),
            profit: tail.reduce((sum, item) => sum + item.profit, 0),
            salesCount: tail.reduce((sum, item) => sum + item.salesCount, 0),
            itemsCount: tail.reduce((sum, item) => sum + item.itemsCount, 0),
            percentageOfTotal: tail.reduce((sum, item) => sum + item.percentageOfTotal, 0),
          } satisfies DashboardBreakdown,
        ]
      : visible;

  const max = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <ChartCard title={title} description={description}>
      {rows.length === 0 ? (
        <ChartEmptyState message={emptyMessage} />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={`${row.id ?? "other"}-${row.name}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-foreground" title={row.name}>
                  {row.name}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatCurrency(row.revenue)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--chart-1))]"
                    style={{ width: `${Math.max((row.revenue / max) * 100, 2)}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {row.percentageOfTotal.toFixed(1).replace(".", ",")}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}


