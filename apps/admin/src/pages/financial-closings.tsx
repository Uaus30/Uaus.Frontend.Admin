import { Button } from "@workspace/ui";
import { TablePagination } from "@workspace/ui";
import { Lock, Plus, RefreshCw } from "lucide-react";
import { PAGE_SIZE, useFinancialClosings } from "@/features/financial-closings/hooks/useFinancialClosings";
import { useNewClosing } from "@/features/financial-closings/hooks/useNewClosing";
import { FinancialClosingsTable } from "@/features/financial-closings/components/FinancialClosingsTable";
import { NewClosingDialog } from "@/features/financial-closings/components/NewClosingDialog";
import { ClosingDetailsDialog } from "@/features/financial-closings/components/ClosingDetailsDialog";

/**
 * Fechamentos Mensais (`/financeiro/fechamentos`).
 *
 * Página fina: a listagem e o detalhe vêm de `useFinancialClosings`; o novo
 * fechamento em três passos, de `useNewClosing`.
 */
export default function FinancialClosingsPage() {
  const {
    closings,
    closingsPage,
    isLoading,
    refetch,
    page,
    setPage,
    detailsId,
    closingDetails,
    isLoadingDetails,
    isDeleting,
    closeDetails,
    openDetails,
    handleDeleteClosing,
  } = useFinancialClosings();
  const newClosing = useNewClosing();

  return (
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
            Congele os números do mês, o rateio entre os sócios e o saldo que fica para a loja — o saldo
            confirmado abre o mês seguinte.
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

          <Button onClick={newClosing.openNewClosing} className="gap-2 hover-elevate">
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

      {/* Novo fechamento (3 passos) */}
      <NewClosingDialog closing={newClosing} />

      {/* Detalhe */}
      <ClosingDetailsDialog
        open={detailsId != null}
        closing={closingDetails}
        isLoading={isLoadingDetails}
        isDeleting={isDeleting}
        onClose={closeDetails}
        onDelete={handleDeleteClosing}
      />
    </div>
  );
}
