import React from "react";
import { AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { useLiveToday } from "@/features/dashboard/hooks/useLiveToday";
import { useMonthlyComparison } from "@/features/dashboard/hooks/useMonthlyComparison";
import { useSalesPatterns } from "@/features/dashboard/hooks/useSalesPatterns";
import { useSalesIntelligence } from "@/features/dashboard/hooks/useSalesIntelligence";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import { DashboardKpis } from "@/features/dashboard/components/DashboardKpis";
import { LiveTodayCard } from "@/features/dashboard/components/LiveTodayCard";
import { RevenueProfitChart } from "@/features/dashboard/components/RevenueProfitChart";
import { MonthComparisonCard } from "@/features/dashboard/components/MonthComparisonCard";
import { WeekComparisonCard } from "@/features/dashboard/components/WeekComparisonCard";
import { useWeekComparison } from "@/features/dashboard/hooks/useWeekComparison";
import { RevenueBreakdownCard } from "@/features/dashboard/components/RevenueBreakdownCard";
import { TopProductsTable } from "@/features/dashboard/components/TopProductsTable";
import { PatternsPanel } from "@/features/dashboard/components/PatternsPanel";
import { IntelligencePanel } from "@/features/dashboard/components/IntelligencePanel";
import { LowStockAlert } from "@/features/low-stock/components/LowStockAlert";

/**
 * Dashboard
 *
 * Painel de indicadores da loja, montado em três camadas de carregamento:
 *
 * 1. **Imediata** — faturamento do dia e os totais do período. É o que a tela
 *    precisa mostrar para ser útil no primeiro segundo.
 * 2. **Em paralelo** — o comparativo mensal, que não depende do período escolhido
 *    e por isso não bloqueia nem é bloqueado pelos filtros.
 * 3. **Sob demanda** — padrões históricos e inteligência comercial, as consultas
 *    caras. Ficam fechadas até o usuário pedir; abri-las junto com a tela faria
 *    todo acesso pagar por um dado que muda uma vez por dia.
 */
export default function Dashboard() {
  const dashboard = useDashboard();
  const live = useLiveToday();
  const monthly = useMonthlyComparison();
  const weekComparison = useWeekComparison();
  const patterns = useSalesPatterns();
  const intelligence = useSalesIntelligence();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <PeriodSelector
          periodMode={dashboard.periodMode}
          preset={dashboard.preset}
          periodLabel={dashboard.period.label}
          customStart={dashboard.customStart}
          setCustomStart={dashboard.setCustomStart}
          customEnd={dashboard.customEnd}
          setCustomEnd={dashboard.setCustomEnd}
          handleApplyCustom={dashboard.handleApplyCustom}
          handleSelectPreset={dashboard.handleSelectPreset}
          handleClearCustom={dashboard.handleClearCustom}
          isFetching={dashboard.isFetching}
          onRefresh={dashboard.refreshAll}
        />

        {/* Vermelho só com pendência: some sozinho quando não há o que repor. */}
        <LowStockAlert />

        {dashboard.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Não foi possível carregar os indicadores do período. Verifique a conexão com o servidor e tente
              novamente.
            </span>
          </div>
        )}

        <LiveTodayCard
          today={live.today}
          isLoading={live.isLoading}
          isFetching={live.isFetching}
          updatedAt={live.updatedAt}
          onRefresh={live.refetch}
        />

        <DashboardKpis overview={dashboard.overview} isLoading={dashboard.isLoading} />

        <RevenueProfitChart
          series={dashboard.overview?.series ?? []}
          periodLabel={dashboard.period.label}
          isLoading={dashboard.isLoading}
        />

        <WeekComparisonCard
          days={weekComparison.days}
          week={weekComparison.week}
          isLoading={weekComparison.isLoading}
        />

        <MonthComparisonCard
          monthly={monthly.monthly}
          comparison={monthly.comparison}
          isLoading={monthly.isLoading}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RevenueBreakdownCard
            title="Faturamento por categoria"
            description={dashboard.period.label}
            items={dashboard.overview?.byCategory ?? []}
            isLoading={dashboard.isLoading}
            emptyMessage="Nenhuma venda por categoria no período selecionado."
          />
          <RevenueBreakdownCard
            title="Formas de pagamento"
            description={dashboard.period.label}
            items={dashboard.overview?.byPaymentMethod ?? []}
            isLoading={dashboard.isLoading}
            emptyMessage="Nenhum pagamento registrado no período selecionado."
          />
        </div>

        <TopProductsTable
          products={dashboard.overview?.topProducts ?? []}
          periodLabel={dashboard.period.label}
          isLoading={dashboard.isLoading}
        />

        <PatternsPanel {...patterns} />

        <IntelligencePanel {...intelligence} />
      </div>
    </AppLayout>
  );
}
