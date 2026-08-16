import React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui";
import type { InventoryReport } from "../types";

type CategorySummaryProps = {
  /** The inventory report containing category breakdown and system alerts */
  report: any;
  /** Callback to format numeric values as currency (BRL) */
  formatCurrency: (val: number) => string;
  /** Callback to format numeric values as percentage */
  formatPercent: (val: number) => string;
};

/**
 * CategorySummary
 *
 * Component rendering distribution stats by category and system alert boxes.
 */
export function CategorySummary({ report, formatCurrency, formatPercent }: CategorySummaryProps) {
  if (!report) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Category Report Card */}
      <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
            Resumo por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-60 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.categorySummaries.slice(0, 10).map((cat: any, i: number) => (
              <div key={i} className="flex flex-col gap-1 p-3 rounded-lg border border-border/30 bg-muted/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold truncate max-w-[150px]" title={cat.categoryName}>
                    {cat.categoryName}
                  </span>
                  <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {formatPercent(cat.percentageOfTotalValue)} do total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-2xs text-muted-foreground mt-2 border-t border-border/20 pt-2">
                  <div>
                    Produtos: <strong className="text-foreground">{cat.productsCount}</strong>
                  </div>
                  <div>
                    Unidades: <strong className="text-foreground">{cat.unitsCount}</strong>
                  </div>
                  <div>
                    Venda:{" "}
                    <strong className="text-emerald-500">{formatCurrency(cat.merchandiseValue)}</strong>
                  </div>
                  <div>
                    Lucro est.:{" "}
                    <strong className="text-emerald-500">{formatCurrency(cat.estimatedProfit)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alert Box Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">
            Alertas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-500">Produtos sem Estoque</h4>
              <p className="text-lg font-bold text-red-600 mt-1">{report.metrics.alertsNoStock}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-500">Estoque Baixo (Alerta)</h4>
              <p className="text-lg font-bold text-amber-600 mt-1">{report.metrics.alertsLowStock}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
