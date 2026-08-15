import { AlertTriangle, ChartColumn, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { formatDateInput, parseDateInput } from "@workspace/ui";
import { DateRangePicker, type DateRange } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { cn } from "@workspace/ui";
import { useFinancialReports } from "@/features/financial-reports/hooks/useFinancialReports";
import { FinancialReportKpis } from "@/features/financial-reports/components/FinancialReportKpis";
import { FinancialReportWarnings } from "@/features/financial-reports/components/FinancialReportWarnings";
import { FixedCostsCard } from "@/features/financial-reports/components/FixedCostsCard";
import { WriteOffsByReasonCard } from "@/features/financial-reports/components/WriteOffsByReasonCard";
import { PartnerDistributionCard } from "@/features/financial-reports/components/PartnerDistributionCard";

/**
 * Página de Relatórios Financeiros — prévia ao vivo do resultado do período.
 *
 * Página fina: todo o estado vive em `useFinancialReports`; aqui só entram o
 * layout e a conversão string ↔ Date do calendário (padrão SalesTable).
 */
export default function FinancialReportsPage() {
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    summary,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useFinancialReports();

  // O hook trafega as datas como string (yyyy-MM-dd); o calendário trabalha
  // com Date. A conversão fica na borda, sem mexer no hook.
  const dateRange: DateRange = {
    from: parseDateInput(startDate),
    to: parseDateInput(endDate),
  };

  /** Aplica o período escolhido no calendário. */
  function handleDateRangeChange(range: DateRange) {
    setStartDate(formatDateInput(range.from));
    setEndDate(formatDateInput(range.to));
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ChartColumn className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Relatórios Financeiros
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Prévia do resultado do período calculada ao vivo — o documento oficial é o
              fechamento financeiro.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            title="Atualizar dados"
            className="hover-elevate"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex flex-col gap-1.5 w-full sm:w-64">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Período
            </Label>
            <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          </div>
          <p className="text-xs text-muted-foreground sm:pb-2.5">
            Sem período selecionado, o relatório considera os últimos 30 dias.
          </p>
        </div>

        {/*
          Falha na consulta substitui o conteúdo: sem este estado, os skeletons
          dos indicadores ficariam girando para sempre (summary nunca chega).
        */}
        {isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">
              Não foi possível carregar o relatório financeiro.
            </p>
            <p className="text-sm text-muted-foreground">{describeApiError(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {/* Avisos do backend (período parcial de mês, distribuição não configurada...) */}
            <FinancialReportWarnings warnings={summary?.warnings ?? []} />

            {/* Indicadores do período */}
            <FinancialReportKpis summary={summary} isLoading={isLoading} />

            {/* Detalhamentos */}
            {summary && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <FixedCostsCard fixedCosts={summary.fixedCosts} />
                <WriteOffsByReasonCard writeOffs={summary.writeOffs} />
                <PartnerDistributionCard
                  distribution={summary.partnerDistribution}
                  netProfit={summary.netProfit}
                  className="xl:col-span-2"
                />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}


