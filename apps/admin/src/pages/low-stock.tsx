import { FileSpreadsheet, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useLowStock } from "@/features/low-stock/hooks/useLowStock";
import { LowStockTable } from "@/features/low-stock/components/LowStockTable";
import { LowStockConfirmDialog } from "@/features/low-stock/components/LowStockConfirmDialog";

/**
 * Relatório de estoque baixo.
 *
 * Renderiza o que `useLowStock` devolve: a tabela e as confirmações. Regra do
 * §4 do CLAUDE.md: nenhuma query mora aqui.
 *
 * Os dois cards de contagem (pendentes e resolvidos) saíram em 06/09/2026: eles
 * repetiam, em números grandes, o que a própria lista mostra logo abaixo — e o
 * alerta que traz a pessoa até aqui já disse quantos são.
 */
export default function LowStock() {
  const report = useLowStock();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Estoque baixo</h1>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              Produtos vivos com estoque mínimo configurado e saldo igual ou abaixo dele.{" "}
              <strong>Resolver</strong> é registrar o pedido de compra: sem compra em aberto o botão leva ao
              formulário de reposição; com compra, ele confirma o alerta como tratado. Uma entrada de estoque
              que passe do mínimo tira o produto daqui sozinha.
            </p>
          </div>
          <Button
            onClick={report.exportToXlsx}
            disabled={report.isExporting}
            className="shrink-0 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {report.isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Exportar XLSX
          </Button>
        </div>

        <LowStockTable
          items={report.items}
          isLoading={report.isLoading}
          search={report.search}
          setSearch={report.setSearch}
          maxStock={report.maxStock}
          setMaxStock={report.setMaxStock}
          minRecentSales={report.minRecentSales}
          setMinRecentSales={report.setMinRecentSales}
          sort={report.sort}
          onToggleSalesSort={report.toggleSalesSort}
          includeResolved={report.includeResolved}
          setIncludeResolved={report.setIncludeResolved}
          page={report.page}
          totalPages={report.totalPages}
          setPage={report.setPage}
          onResolve={report.resolve}
          onReopen={report.reopen}
          onDisableStockControl={report.askDisableStockControl}
          mutatingProductId={report.mutatingProductId}
        />
      </div>

      <LowStockConfirmDialog
        confirm={report.confirm}
        onCancel={report.cancelConfirm}
        onConfirm={report.confirmAction}
        isSaving={report.isConfirming}
      />
    </AppLayout>
  );
}
