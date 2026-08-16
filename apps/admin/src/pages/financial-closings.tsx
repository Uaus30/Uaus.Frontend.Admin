import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { DateRangePicker, type DateRange } from "@workspace/ui";
import { formatDateInput, parseDateInput } from "@workspace/ui";
import { Lock, Plus, RefreshCw } from "lucide-react";
import { PAGE_SIZE, useFinancialClosings } from "@/features/financial-closings/hooks/useFinancialClosings";
import { FinancialClosingsTable } from "@/features/financial-closings/components/FinancialClosingsTable";
import { NewClosingDialog } from "@/features/financial-closings/components/NewClosingDialog";
import { ClosingDetailsDialog } from "@/features/financial-closings/components/ClosingDetailsDialog";

export default function FinancialClosingsPage() {
  const {
    closings,
    closingsPage,
    isLoading,
    refetch,
    page,
    setPage,
    filterStartDate,
    filterEndDate,
    handleFilterRangeChange,
    newClosingOpen,
    step,
    periodStart,
    periodEnd,
    notes,
    setNotes,
    preview,
    isCalculatingPreview,
    isSavingClosing,
    openNewClosing,
    closeNewClosing,
    handlePeriodChange,
    applyPreviousMonth,
    handleCalculatePreview,
    backToPeriod,
    handleConfirmClosing,
    detailsId,
    closingDetails,
    isLoadingDetails,
    isDeleting,
    closeDetails,
    openDetails,
    handleDeleteClosing,
  } = useFinancialClosings();

  // O hook trafega o filtro como string (yyyy-MM-dd); o calendário trabalha
  // com Date. A conversão fica na borda, sem mexer no hook.
  const filterRange: DateRange = {
    from: parseDateInput(filterStartDate),
    to: parseDateInput(filterEndDate),
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Fechamentos Financeiros
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Congele os números de um período e o rateio de lucros entre os sócios — o fechamento é o
              documento oficial do módulo financeiro.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Atualizar dados"
              className="hover-elevate"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button onClick={openNewClosing} className="gap-2 hover-elevate">
              <Plus className="w-4 h-4" /> Novo Fechamento
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex flex-col gap-1.5 w-full sm:w-64">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Período (início do fechamento)
            </Label>
            <DateRangePicker
              value={filterRange}
              onChange={(range) =>
                handleFilterRangeChange(formatDateInput(range.from), formatDateInput(range.to))
              }
            />
          </div>
        </div>

        {/* Tabela */}
        <FinancialClosingsTable items={closings} isLoading={isLoading} onRowClick={openDetails} />

        {/* Paginação */}
        {closingsPage && closingsPage.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: {closingsPage.total} fechamentos</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>

              <span>
                Página {page} de {closingsPage.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= closingsPage.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

        {/* Diálogo de novo fechamento (2 passos) */}
        <NewClosingDialog
          open={newClosingOpen}
          step={step}
          periodStart={periodStart}
          periodEnd={periodEnd}
          notes={notes}
          preview={preview}
          isCalculating={isCalculatingPreview}
          isSaving={isSavingClosing}
          onClose={closeNewClosing}
          onPeriodChange={handlePeriodChange}
          onApplyPreviousMonth={applyPreviousMonth}
          onCalculatePreview={handleCalculatePreview}
          onBackToPeriod={backToPeriod}
          onNotesChange={setNotes}
          onConfirm={handleConfirmClosing}
        />

        {/* Diálogo de detalhe */}
        <ClosingDetailsDialog
          open={detailsId != null}
          closing={closingDetails}
          isLoading={isLoadingDetails}
          isDeleting={isDeleting}
          onClose={closeDetails}
          onDelete={handleDeleteClosing}
        />
      </div>
    </AppLayout>
  );
}
