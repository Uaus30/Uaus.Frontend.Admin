import React from "react";
import { Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { DashboardOverview } from "../types";
import { growth } from "../utils";
import { StatTile } from "./StatTile";

type DashboardKpisProps = {
  overview?: DashboardOverview;
  isLoading: boolean;
};

/**
 * DashboardKpis
 *
 * Os quatro números que abrem o painel: faturamento, lucro, vendas e ticket médio.
 *
 * A margem aparece como linha de apoio do card de lucro em vez de ganhar um quinto
 * card — ela é a leitura do lucro, não um indicador independente, e uma fileira de
 * cinco quebra o ritmo da grade em telas médias.
 */
export function DashboardKpis({ overview, isLoading }: DashboardKpisProps) {
  if (isLoading || !overview) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[168px] rounded-xl" />
        ))}
      </div>
    );
  }

  const { current, previous, series } = overview;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Faturamento"
        value={formatCurrency(current.revenue)}
        delta={growth(current.revenue, previous.revenue)}
        icon={Wallet}
        trend={series.map((point) => point.revenue)}
        trendColor="hsl(var(--chart-1))"
        hint={current.discount > 0 ? `${formatCurrency(current.discount)} em descontos` : undefined}
      />
      <StatTile
        label="Lucro"
        value={formatCurrency(current.profit)}
        delta={growth(current.profit, previous.profit)}
        icon={TrendingUp}
        trend={series.map((point) => point.profit)}
        trendColor="hsl(var(--chart-2))"
        hint={`Margem de ${current.marginPercentage.toFixed(1).replace(".", ",")}%`}
      />
      <StatTile
        label="Vendas"
        value={current.salesCount.toLocaleString("pt-BR")}
        delta={growth(current.salesCount, previous.salesCount)}
        icon={ShoppingCart}
        trend={series.map((point) => point.salesCount)}
        trendColor="hsl(var(--chart-3))"
        hint={`${current.itemsCount.toLocaleString("pt-BR")} itens vendidos`}
      />
      <StatTile
        label="Ticket médio"
        value={formatCurrency(current.averageTicket)}
        delta={growth(current.averageTicket, previous.averageTicket)}
        icon={Receipt}
        hint={
          current.cancelledSalesCount > 0
            ? `${current.cancelledSalesCount} venda(s) cancelada(s) no período`
            : undefined
        }
      />
    </div>
  );
}
