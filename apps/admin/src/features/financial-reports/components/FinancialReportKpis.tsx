import {
  BadgePercent,
  HandCoins,
  Package,
  PackageCheck,
  PackagePlus,
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
import { formatCurrency, formatPercentage, formatQuantity } from "@workspace/core";
import { cn } from "@workspace/ui";
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
        <p className={cn("mt-2 text-2xl font-display font-bold tracking-tight", valueClassName)}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Os doze cards, para o esqueleto ter o tamanho da grade que vem. */
const KPI_COUNT = 12;

/**
 * FinancialReportKpis
 *
 * Os números do período na MESMA conta do resultado do fechamento (versão 2,
 * 23/11/2026): vendas brutas, descontos por origem, vendas líquidas, custo das
 * vendas, lucro bruto, baixas e sobras (agora dentro do lucro), custos fixos e
 * lucro líquido. Sem a mesma conta, o resumo e o fechamento do mesmo mês dariam
 * lucros diferentes.
 *
 * O "Compras" antigo somava ENTRADAS de estoque pela data de entrada, inclusive
 * o ajuste manual: virou "Entradas de estoque", ao lado das "Compras pagas" — o
 * dinheiro que saiu, pela data da compra, que é o que a faixa de compras usa.
 * Os dois são informativos: o custo do que foi vendido já está no CMV.
 */
export function FinancialReportKpis({ summary, isLoading }: FinancialReportKpisProps) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, index) => (
          <Skeleton key={index} className="h-[110px] rounded-xl" />
        ))}
      </div>
    );
  }

  const { sales, fixedCosts, writeOffs } = summary;
  const saleDiscount = summary.discountsTotal - summary.itemDiscountsTotal;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Vendas brutas"
        value={formatCurrency(summary.grossSales)}
        icon={Wallet}
        hint="Vendas líquidas + descontos concedidos"
      />
      <KpiCard
        label="Descontos concedidos"
        value={formatCurrency(summary.discountsTotal)}
        icon={BadgePercent}
        hint={`No item ${formatCurrency(summary.itemDiscountsTotal)} (promoção ${formatCurrency(summary.promotionDiscountsTotal)}) · na venda ${formatCurrency(saleDiscount)} (cupom ${formatCurrency(summary.couponDiscountsTotal)})`}
      />
      <KpiCard
        label="Vendas líquidas"
        value={formatCurrency(sales.revenue)}
        icon={Receipt}
        hint={`${sales.salesCount.toLocaleString("pt-BR")} venda(s) · ticket médio ${formatCurrency(sales.averageTicket)}`}
      />
      <KpiCard
        label="Custo das vendas (CMV)"
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
        label="Baixas a custo"
        value={formatCurrency(writeOffs.totalCost)}
        icon={PackageX}
        hint={`${formatQuantity(writeOffs.totalQuantity)} item(ns) — descontam do lucro líquido`}
      />
      <KpiCard
        label="Sobras de estoque"
        value={formatCurrency(summary.stockSurplusTotal)}
        icon={PackagePlus}
        hint="Entradas de ajuste manual — somam no lucro"
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
        hint="Lucro bruto − baixas + sobras − custos fixos"
        className="border-primary/40 bg-primary/5"
        valueClassName={summary.netProfit < 0 ? "text-destructive" : undefined}
      />
      <KpiCard
        label="Compras pagas"
        value={formatCurrency(summary.purchasesPaidTotal)}
        icon={ShoppingCart}
        hint="O dinheiro que saiu, pela data da compra — informativo"
      />
      <KpiCard
        label="Entradas de estoque"
        value={formatCurrency(summary.purchasesTotal)}
        icon={PackageCheck}
        hint="Pela data de entrada, com o ajuste manual — informativo"
      />
      <KpiCard
        label="Aportes"
        value={formatCurrency(summary.contributionsTotal)}
        icon={HandCoins}
        hint="Entram no caixa, não no lucro"
      />
    </div>
  );
}
