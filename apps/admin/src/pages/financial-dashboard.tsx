import { Gauge, RefreshCw } from "lucide-react";
import { Button, cn } from "@workspace/ui";
import { MonthSwitcher } from "@/components/month-switcher";
import { useFinancialDashboard } from "@/features/financial-dashboard/hooks/useFinancialDashboard";
import { BudgetBandCard } from "@/features/financial-dashboard/components/BudgetBandCard";
import { MonthNumbersCard } from "@/features/financial-dashboard/components/MonthNumbersCard";
import { StockAtCostCard } from "@/features/financial-dashboard/components/StockAtCostCard";
import { ContributionsCard } from "@/features/financial-dashboard/components/ContributionsCard";
import { ClosingsHistoryCard } from "@/features/financial-dashboard/components/ClosingsHistoryCard";

/**
 * Painel Financeiro (`/financeiro/painel`) — abre o grupo Financeiro.
 *
 * Junta a faixa de compras do mês, o mês em números, o estoque a custo, os
 * aportes e o histórico dos meses fechados. Página fina: tudo vem de
 * `useFinancialDashboard`. Pensada primeiro para o celular — uma coluna, e duas
 * a partir do `xl`.
 */
export default function FinancialDashboardPage() {
  const dashboard = useFinancialDashboard();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Painel Financeiro
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Se o mês aguenta as compras, de onde veio o dinheiro e o que ficou em cada fechamento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <MonthSwitcher
            month={dashboard.month}
            onChange={dashboard.setMonth}
            maxMonth={dashboard.currentMonth}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={dashboard.refetchAll}
            title="Atualizar dados"
            aria-label="Atualizar dados"
            className="h-11 w-11 shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", dashboard.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <BudgetBandCard
        budget={dashboard.budget}
        isLoading={dashboard.isLoadingBudget}
        error={dashboard.budgetError}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <MonthNumbersCard
          budget={dashboard.budget}
          summary={dashboard.summary}
          isLoadingSummary={dashboard.isLoadingSummary}
        />
        <div className="space-y-6">
          <StockAtCostCard budget={dashboard.budget} isLoading={dashboard.isLoadingBudget} />
          <ContributionsCard
            contributions={dashboard.contributions}
            isLoading={dashboard.isLoadingContributions}
            partnerTotals={dashboard.partnerTotals}
          />
        </div>
      </div>

      <ClosingsHistoryCard closings={dashboard.closings} isLoading={dashboard.isLoadingHistory} />
    </div>
  );
}
