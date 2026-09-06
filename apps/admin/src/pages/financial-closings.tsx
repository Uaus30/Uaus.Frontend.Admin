import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { TablePagination } from "@workspace/ui";
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
    newClosingOpen,
    step,
    year,
    month,
    yearOptions,
    monthOptions,
    isLoadingMonths,
    notes,
    setNotes,
    preview,
    isCalculatingPreview,
    isSavingClosing,
    openNewClosing,
    closeNewClosing,
    handleYearChange,
    handleMonthChange,
    applyLastMonth,
    handleCalculatePreview,
    handleAddVariableCost,
    handleRemoveVariableCost,
    backToCompetence,
    handleConfirmClosing,
    detailsId,
    closingDetails,
    isLoadingDetails,
    isDeleting,
    closeDetails,
    openDetails,
    handleDeleteClosing,
  } = useFinancialClosings();

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

        {/* Tabela — todos os fechamentos, do mais recente para o mais antigo */}
        <FinancialClosingsTable items={closings} isLoading={isLoading} onRowClick={openDetails} />

        {/* Paginação */}
        {closingsPage && (
          <TablePagination
            page={page}
            pageSize={closingsPage.limit || PAGE_SIZE}
            total={closingsPage.total}
            onPageChange={setPage}
            itemLabel={{ singular: "fechamento", plural: "fechamentos" }}
          />
        )}

        {/* Diálogo de novo fechamento (2 passos) */}
        <NewClosingDialog
          open={newClosingOpen}
          step={step}
          year={year}
          month={month}
          yearOptions={yearOptions}
          monthOptions={monthOptions}
          isLoadingMonths={isLoadingMonths}
          notes={notes}
          preview={preview}
          isCalculating={isCalculatingPreview}
          isSaving={isSavingClosing}
          onClose={closeNewClosing}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          onApplyLastMonth={applyLastMonth}
          onCalculatePreview={handleCalculatePreview}
          onAddVariableCost={handleAddVariableCost}
          onRemoveVariableCost={handleRemoveVariableCost}
          onBackToCompetence={backToCompetence}
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
