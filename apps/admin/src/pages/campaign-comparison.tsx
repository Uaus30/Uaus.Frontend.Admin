import { AlertTriangle, BarChart3, Download, RefreshCw } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, DateRangePicker, Label, cn } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { useCampaignComparison } from "@/features/campaigns/hooks/useCampaignComparison";
import { CampaignReportComparisonPicker } from "@/features/campaigns/components/campaign-report-comparison-picker";
import { CampaignReportComparisonChart } from "@/features/campaigns/components/campaign-report-comparison-chart";
import { CampaignReportComparisonTable } from "@/features/campaigns/components/campaign-report-comparison-table";

/**
 * Página de Comparativo de Campanhas.
 *
 * Página fina: todo o estado vive em `useCampaignComparison`. Aqui ficam o
 * layout e o calendário — cuja conversão para instante acontece dentro do hook,
 * porque campanha é controlada por data E hora.
 *
 * O filtro de período só ENCOLHE a janela de cada campanha. Uma campanha de
 * agosto consultada com filtro de setembro sai zerada, e não com as vendas de
 * setembro: medir uma campanha fora do ar contra um denominador em que ela não
 * estava rodando produziria participação inventada.
 */
export default function CampaignComparisonPage() {
  const {
    searchInput,
    setSearchInput,
    campaigns,
    isLoadingCampaigns,
    selectedIds,
    toggleCampaign,
    clearSelection,
    maxCampaigns,
    dateRange,
    setDateRange,
    metric,
    metrics,
    setMetricValue,
    rows,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    handleExportCsv,
  } = useCampaignComparison();

  const hasSelection = selectedIds.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Comparativo de Campanhas
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Campanhas lado a lado, cada uma medida na janela dela e contra o faturamento da loja no mesmo
              intervalo.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover-elevate"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Atualizar dados"
              className="hover-elevate"
              disabled={!hasSelection}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
          <div className="flex w-full flex-col gap-1.5 sm:w-64">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recorte de período
            </Label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
          <p className="text-xs text-muted-foreground sm:pb-2.5">
            Opcional. O recorte só encolhe a janela de cada campanha — nunca a estica para fora do período em
            que ela esteve no ar.
          </p>
        </div>

        {isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">Não foi possível carregar o comparativo.</p>
            <p className="text-sm text-muted-foreground">{describeApiError(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <CampaignReportComparisonPicker
                campaigns={campaigns}
                isLoading={isLoadingCampaigns}
                selectedIds={selectedIds}
                onToggle={toggleCampaign}
                onClear={clearSelection}
                maxCampaigns={maxCampaigns}
                searchInput={searchInput}
                onSearchChange={setSearchInput}
              />

              <CampaignReportComparisonChart
                rows={rows}
                metric={metric}
                metrics={metrics}
                onMetricChange={setMetricValue}
                // Sem seleção a query fica desligada e `isLoading` seria falso de
                // qualquer jeito; o gate explícito evita que um refetch em voo
                // troque o convite ("escolha uma campanha") por um esqueleto.
                isLoading={hasSelection && isLoading}
                hasSelection={hasSelection}
              />
            </div>

            <CampaignReportComparisonTable rows={rows} hasSelection={hasSelection} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
