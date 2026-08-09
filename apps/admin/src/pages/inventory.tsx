import React from "react";
import { FileSpreadsheet } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useInventory } from "@/features/inventory/hooks/useInventory";
import { InventoryMetrics } from "@/features/inventory/components/InventoryMetrics";
import { CategorySummary } from "@/features/inventory/components/CategorySummary";
import { InventoryTable } from "@/features/inventory/components/InventoryTable";

/**
 * Inventory Page Component
 * 
 * Renders the product stock inventory dashboard, connecting page controls
 * and panels to the useInventory state manager hook.
 */
export default function Inventory() {
  const {
    search,
    setSearch,
    selectedSupplier,
    setSelectedSupplier,
    selectedCategory,
    setSelectedCategory,
    stockStatus,
    setStockStatus,
    page,
    setPage,
    zoomScale,
    report,
    isLoading,
    isFetching,
    suppliers,
    categories,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    formatCurrency,
    formatPercent,
    handleExportExcel,
  } = useInventory();

  // Displays loader if report is initial loading, but remains interactive on fetches
  const isInitialLoading = isLoading && !report;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Inventário de Produtos</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-4xl">
              <strong className="text-primary">Sobre este relatório:</strong> Mostra apenas produtos com controle de estoque ativado e pelo menos 1 unidade em estoque. Produtos sem controle, serviços e itens zerados não aparecem aqui. Os valores de mercadoria (preço de venda), custo e lucro estimado são calculados sobre o estoque atual.
            </p>
          </div>
          <Button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white hover-elevate gap-2 shrink-0 self-start sm:self-center"
            disabled={isLoading}
          >
            <FileSpreadsheet className="h-4 w-4" /> Exportar Planilha
          </Button>
        </div>

        <InventoryMetrics
          report={report}
          isLoading={isInitialLoading}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
        />

        <CategorySummary
          report={report}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
        />

        <InventoryTable
          search={search}
          setSearch={setSearch}
          selectedSupplier={selectedSupplier}
          setSelectedSupplier={setSelectedSupplier}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          stockStatus={stockStatus}
          setStockStatus={setStockStatus}
          page={page}
          setPage={setPage}
          zoomScale={zoomScale}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          handleResetZoom={handleResetZoom}
          suppliers={suppliers}
          categories={categories}
          isLoading={isInitialLoading}
          isError={false} // Error checking handled by hook internally via toast
          report={report}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
        />
      </div>
    </AppLayout>
  );
}


