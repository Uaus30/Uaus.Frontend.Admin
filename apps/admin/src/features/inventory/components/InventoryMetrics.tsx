import React from "react";
import { Card, CardContent } from "@workspace/ui";
import type { InventoryReport } from "../types";

type InventoryMetricsProps = {
  /** The inventory report containing metric values */
  report: any;
  /** True if the report data is loading */
  isLoading: boolean;
  /** Callback to format numeric values as currency (BRL) */
  formatCurrency: (val: number) => string;
  /** Callback to format numeric values as percentage */
  formatPercent: (val: number) => string;
};

/**
 * InventoryMetrics
 * 
 * Component rendering the top metrics dashboard cards for the inventory.
 */
export function InventoryMetrics({
  report,
  isLoading,
  formatCurrency,
  formatPercent,
}: InventoryMetricsProps) {
  if (isLoading && !report) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse bg-muted/20 border-border/40 h-28" />
        ))}
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="border-start border-primary border-3 bg-card/60 hover-elevate">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Produtos em Estoque</span>
          <div>
            <h3 className="text-2xl font-bold text-foreground mt-2">
              {report.metrics.totalProductsWithControl}
            </h3>
            <p className="text-2xs text-muted-foreground mt-1">com controle ativo</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-start border-info border-3 bg-card/60 hover-elevate">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Unidades em Estoque</span>
          <div>
            <h3 className="text-2xl font-bold text-foreground mt-2">
              {report.metrics.totalUnits.toLocaleString("pt-BR")}
            </h3>
            <p className="text-2xs text-muted-foreground mt-1">unidades físicas</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-start border-success border-3 bg-card/60 hover-elevate">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Valor em Mercadoria</span>
          <div>
            <h3 className="text-2xl font-bold text-emerald-500 mt-2">
              {formatCurrency(report.metrics.totalValueMerchandise)}
            </h3>
            <p className="text-2xs text-muted-foreground mt-1">preço de venda</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-start border-warning border-3 bg-card/60 hover-elevate">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Valor em Custo</span>
          <div>
            <h3 className="text-2xl font-bold text-amber-500 mt-2">
              {formatCurrency(report.metrics.totalValueCost)}
            </h3>
            <p className="text-2xs text-muted-foreground mt-1">capital investido</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-start border-success border-3 bg-card/60 hover-elevate">
        <CardContent className="p-4 flex flex-col justify-between h-full">
          <span className="text-xs text-muted-foreground font-semibold uppercase">Lucro Estimado</span>
          <div>
            <h3 className="text-2xl font-bold text-emerald-500 mt-2">
              {formatCurrency(report.metrics.totalEstimatedProfit)}
            </h3>
            <p className="text-2xs text-emerald-500/80 font-medium mt-1">
              Margem: {formatPercent(report.metrics.marginPercentage)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


