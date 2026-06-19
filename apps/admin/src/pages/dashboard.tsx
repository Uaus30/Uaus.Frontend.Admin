import React from "react";
import { AppLayout } from "@/components/layout";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { PeriodSelector } from "@/features/dashboard/components/PeriodSelector";
import { DashboardMetrics } from "@/features/dashboard/components/DashboardMetrics";
import { DashboardCharts } from "@/features/dashboard/components/DashboardCharts";
import { TopProductsTable } from "@/features/dashboard/components/TopProductsTable";
import {
  dashboardMockCategoryData,
  dashboardMockChartData,
  dashboardMockMetrics,
  dashboardMockTopProducts,
} from "@/lib/mock-data";

/**
 * Dashboard Page Component
 * 
 * Renders the visao geral dashboard analytics, linking filters
 * and panels to useDashboard.
 */
export default function Dashboard() {
  const {
    periodMode,
    setPeriodMode,
    period,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    popoverOpen,
    setPopoverOpen,
    periodLabel,
    handleApplyCustom,
    handleSelectPreset,
  } = useDashboard();

  return (
    <AppLayout>
      <div className="flex flex-col gap-8">
        <PeriodSelector
          periodMode={periodMode}
          setPeriodMode={setPeriodMode}
          period={period}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          popoverOpen={popoverOpen}
          setPopoverOpen={setPopoverOpen}
          periodLabel={periodLabel}
          handleApplyCustom={handleApplyCustom}
          handleSelectPreset={handleSelectPreset}
        />

        <div className="-mt-4 flex items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            Exibindo: {periodLabel}
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
            Dados mockados
          </span>
          {periodMode === "custom" && (
            <button onClick={() => setPeriodMode("preset")} className="text-xs text-primary hover:underline">
              Limpar
            </button>
          )}
        </div>

        <DashboardMetrics metrics={dashboardMockMetrics} />

        <DashboardCharts chartData={dashboardMockChartData} categoryData={dashboardMockCategoryData} />

        <TopProductsTable topProducts={dashboardMockTopProducts} />
      </div>
    </AppLayout>
  );
}
