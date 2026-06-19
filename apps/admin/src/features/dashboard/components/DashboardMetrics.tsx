import React from "react";
import { ArrowDownRight, ArrowUpRight, DollarSign, PackageSearch, ShoppingCart, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

type MetricCardProps = {
  title: string;
  value: string;
  growth: number;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * MetricCard
 * 
 * Individual KPI card item showing values and positive/negative comparison percentages.
 */
function MetricCard({ title, value, growth, icon: Icon }: MetricCardProps) {
  const isPositive = growth >= 0;

  return (
    <Card className="relative overflow-hidden border-border/50 p-6 shadow-lg shadow-black/5 hover-elevate">
      <div className="pointer-events-none absolute right-0 top-0 p-6 opacity-5">
        <Icon className="h-16 w-16" />
      </div>
      <div className="mb-4 flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div>
        <h4 className="text-3xl font-display font-bold text-foreground">{value}</h4>
        <div className="mt-2 flex items-center gap-1">
          {isPositive ? (
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          )}
          <span className={`text-sm font-medium ${isPositive ? "text-emerald-500" : "text-destructive"}`}>
            {Math.abs(growth).toFixed(1)}%
          </span>
          <span className="ml-1 text-xs text-muted-foreground">vs período anterior</span>
        </div>
      </div>
    </Card>
  );
}

type DashboardMetricsProps = {
  /** The consolidated dashboard metrics payload */
  metrics: {
    totalRevenue: number;
    revenueGrowth: number;
    totalSales: number;
    salesGrowth: number;
    averageTicket: number;
    ticketGrowth: number;
    totalProfit: number;
    profitGrowth: number;
  };
};

/**
 * DashboardMetrics
 * 
 * Grid mapping MetricCard blocks for key corporate parameters.
 */
export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Faturamento Total"
        value={formatCurrency(metrics.totalRevenue)}
        growth={metrics.revenueGrowth}
        icon={DollarSign}
      />
      <MetricCard
        title="Total de Vendas"
        value={metrics.totalSales.toString()}
        growth={metrics.salesGrowth}
        icon={ShoppingCart}
      />
      <MetricCard
        title="Ticket Médio"
        value={formatCurrency(metrics.averageTicket)}
        growth={metrics.ticketGrowth}
        icon={TrendingUp}
      />
      <MetricCard
        title="Lucro Total"
        value={formatCurrency(metrics.totalProfit)}
        growth={metrics.profitGrowth}
        icon={PackageSearch}
      />
    </div>
  );
}
