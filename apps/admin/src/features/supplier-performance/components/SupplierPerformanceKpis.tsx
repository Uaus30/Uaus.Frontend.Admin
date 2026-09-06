import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  DollarSign,
  Percent,
  TrendingUp,
} from "lucide-react";
import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type {
  SupplierPerformanceParametersDto,
  SupplierPerformanceTotalsDto,
} from "@workspace/api-client-react";
import { formatInteger, formatPercent } from "../lib/format";

type SupplierPerformanceKpisProps = {
  totals: SupplierPerformanceTotalsDto;
  parameters: SupplierPerformanceParametersDto;
};

/**
 * Os quatro números do conjunto filtrado.
 *
 * O último é capital parado, e não mais um total de venda: é o indicador que a
 * tela de fornecedores tem e o painel não — dinheiro que já saiu do caixa e
 * ainda não voltou.
 */
export function SupplierPerformanceKpis({ totals, parameters }: SupplierPerformanceKpisProps) {
  const variacao =
    totals.previousRevenue > 0
      ? ((totals.revenue - totals.previousRevenue) / totals.previousRevenue) * 100
      : null;

  const aproveitamento = totals.judgedProducts > 0 ? (totals.goodProducts / totals.judgedProducts) * 100 : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        icon={DollarSign}
        label="Faturamento no período"
        value={formatCurrency(totals.revenue)}
        hint={
          variacao === null ? (
            "sem base de comparação"
          ) : (
            <span className="flex items-center gap-1">
              <Delta value={variacao} />
              vs. período anterior
            </span>
          )
        }
      />
      <Kpi
        icon={TrendingUp}
        label="Lucro bruto no período"
        value={formatCurrency(totals.profit)}
        hint={`margem de ${formatPercent(totals.margin)} · ${formatInteger(totals.units)} unidades em ${formatInteger(totals.sales)} vendas`}
      />
      <Kpi
        icon={Percent}
        label="Produtos que vendem bem"
        value={formatPercent(aproveitamento, 0)}
        hint={`${formatInteger(totals.goodProducts)} de ${formatInteger(totals.judgedProducts)} produtos venderam com margem de ${formatPercent(parameters.goodMarginThreshold, 0)} ou mais`}
      />
      <Kpi
        icon={Boxes}
        label="Capital parado em estoque"
        value={formatCurrency(totals.stockCost)}
        hint={`${formatCurrency(totals.stalledStockCost)} em produtos que não venderam no período`}
      />
    </div>
  );
}

function Delta({ value }: { value: number }) {
  const neutro = Math.abs(value) < 0.05;
  const Icon = neutro ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "flex items-center gap-0.5 font-semibold",
        neutro ? "text-muted-foreground" : value > 0 ? "text-emerald-400" : "text-destructive",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {formatPercent(Math.abs(value))}
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-tight">{value}</p>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{hint}</div>
    </Card>
  );
}
