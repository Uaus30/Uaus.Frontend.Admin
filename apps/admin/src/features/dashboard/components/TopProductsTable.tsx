import React from "react";
import { Skeleton } from "@workspace/ui";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { DashboardTopProduct } from "../types";
import { ChartCard, ChartEmptyState } from "./chart-primitives";

type TopProductsTableProps = {
  products: DashboardTopProduct[];
  periodLabel: string;
  isLoading: boolean;
};

/**
 * Etiqueta do nível de estoque.
 *
 * O limiar é o estoque mínimo cadastrado no produto, não um número fixo: cinco
 * unidades é confortável para um item que vende um por semana e é ruptura para
 * outro que vende dez por dia.
 */
function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  const isOut = stock <= 0;
  const isLow = minStock > 0 ? stock <= minStock : stock < 5;

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        isOut
          ? "bg-destructive/15 text-destructive"
          : isLow
            ? "bg-amber-500/15 text-amber-300"
            : "bg-emerald-500/15 text-emerald-300",
      )}
    >
      {stock} un
    </span>
  );
}

/**
 * TopProductsTable
 *
 * Produtos que mais faturaram no período, com margem e estoque ao lado.
 *
 * É uma tabela e não um gráfico porque são cinco medidas por linha: qualquer
 * codificação visual de tantas dimensões perderia para a leitura direta dos
 * números.
 */
export function TopProductsTable({ products, periodLabel, isLoading }: TopProductsTableProps) {
  if (isLoading) {
    return <Skeleton className="h-[360px] rounded-xl" />;
  }

  return (
    <ChartCard title="Produtos mais vendidos" description={periodLabel}>
      {products.length === 0 ? (
        <ChartEmptyState message="Nenhum produto vendido no período selecionado." />
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 pb-2 font-medium">Produto</th>
                <th className="px-2 pb-2 text-right font-medium">Qtd.</th>
                <th className="px-2 pb-2 text-right font-medium">Faturamento</th>
                <th className="px-2 pb-2 text-right font-medium">Lucro</th>
                <th className="px-2 pb-2 text-right font-medium">Margem</th>
                <th className="px-2 pb-2 text-right font-medium">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="max-w-[220px] px-2 py-3">
                    <p className="truncate font-medium text-foreground" title={product.name}>
                      {product.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{product.categoryName}</p>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{product.quantitySold}</td>
                  <td className="px-2 py-3 text-right font-medium tabular-nums">
                    {formatCurrency(product.revenue)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatCurrency(product.profit)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">
                    {product.marginPercentage.toFixed(1).replace(".", ",")}%
                  </td>
                  <td className="px-2 py-3 text-right">
                    <StockBadge stock={product.stock} minStock={product.minStock} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
}


