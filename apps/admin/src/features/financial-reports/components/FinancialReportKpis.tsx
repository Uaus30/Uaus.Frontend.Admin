import {
  Package,
  PackageX,
  PiggyBank,
  Receipt,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@workspace/ui";
import { Skeleton } from "@workspace/ui";
import { formatCurrency, formatPercentage, formatQuantity } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { FinancialReportSummaryDto } from "../types";

type FinancialReportKpisProps = {
  /** Resumo do período; indefinido enquanto carrega ou quando a consulta falha. */
  summary?: FinancialReportSummaryDto;
  isLoading: boolean;
};

type KpiCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Linha de apoio abaixo do valor. */
  hint?: string;
  className?: string;
  valueClassName?: string;
};

/** Card simples de indicador: rótulo, valor e uma linha de apoio opcional. */
function KpiCard({ label, value, icon: Icon, hint, className, valueClassName }: KpiCardProps) {
  return (
    <Card className={cn("border-border/50", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground/70" />
        </div>
        <p className={cn("mt-2 text-2xl font-display font-bold tracking-tight", valueClassName)}>
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * FinancialReportKpis
 *
 * Os oito números do relatório do período. Compras e perdas aparecem lado a
 * lado com os demais, mas são informativas: o CMV já cobre o custo dos itens
 * vendidos, então nenhuma das duas entra no lucro líquido.
 */
export function FinancialReportKpis({ summary, isLoading }: FinancialReportKpisProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <Skeleton key={index} className="h-[110px] rounded-xl" />
        ))}
      </div>
    );
  }

  const { sales, fixedCosts, writeOffs } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Faturamento"
        value={formatCurrency(sales.revenue)}
        icon={Wallet}
        hint={
          sales.discount > 0 ? `${formatCurrency(sales.discount)} em descontos` : undefined
        }
      />
      <KpiCard
        label="CMV"
        value={formatCurrency(sales.cost)}
        icon={Package}
        hint="Custo FIFO dos itens vendidos"
      />
      <KpiCard
        label="Lucro Bruto"
        value={formatCurrency(summary.grossProfit)}
        icon={TrendingUp}
        hint={`Margem de ${formatPercentage(sales.marginPercentage)}`}
      />
      <KpiCard
        label="Custos Fixos"
        value={formatCurrency(fixedCosts.total)}
        icon={ReceiptText}
        hint={`${fixedCosts.items.length} custo(s) no período`}
      />
      <KpiCard
        label="Lucro Líquido"
        value={formatCurrency(summary.netProfit)}
        icon={PiggyBank}
        hint="Lucro bruto − custos fixos"
        className="border-primary/40 bg-primary/5"
        valueClassName={summary.netProfit < 0 ? "text-destructive" : undefined}
      />
      <KpiCard
        label="Compras no período"
        value={formatCurrency(summary.purchasesTotal)}
        icon={ShoppingCart}
        hint="Informativo — não entra no lucro líquido"
      />
      <KpiCard
        label="Perdas no período"
        value={formatCurrency(writeOffs.totalCost)}
        icon={PackageX}
        hint={`${formatQuantity(writeOffs.totalQuantity)} item(ns) baixado(s) — informativo`}
      />
      <KpiCard
        label="Ticket médio"
        value={formatCurrency(sales.averageTicket)}
        icon={Receipt}
        hint={`${sales.salesCount.toLocaleString("pt-BR")} venda(s) no período`}
      />
    </div>
  );
}


