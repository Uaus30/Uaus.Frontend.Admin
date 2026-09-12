import React from "react";
import { ClipboardCheck, FileSpreadsheet, List } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui";
import { useInventory } from "@/features/inventory/hooks/useInventory";
import {
  inventoryTabFromUrl,
  syncInventoryTabToUrl,
  type InventoryTab,
} from "@/features/inventory/inventory-tabs";
import { InventoryMetrics } from "@/features/inventory/components/InventoryMetrics";
import { CategorySummary } from "@/features/inventory/components/CategorySummary";
import { InventoryTable } from "@/features/inventory/components/InventoryTable";
import { InventoryCountPanel } from "@/features/inventory-count/components/InventoryCountPanel";

/**
 * Tela de Inventário, em duas abas.
 *
 * - **Listagem Geral** — o relatório de sempre: métricas, resumo por categoria e
 *   a listagem valorizada do estoque.
 * - **Conferência de Produtos** — a varredura do catálogo para acertar foto,
 *   dados e estoque físico, cadastro a cadastro.
 *
 * As duas moram aqui porque respondem à mesma pergunta por caminhos diferentes:
 * "o que eu tenho em estoque, e isso está certo?". O cabeçalho e o botão de
 * exportar pertencem à Listagem — a conferência tem controles próprios.
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

  // Só na montagem: a aba vira estado, e a URL passa a ser o espelho dele.
  const [activeTab, setActiveTab] = React.useState<InventoryTab>(inventoryTabFromUrl);

  function trocarAba(value: string) {
    const aba: InventoryTab = value === "conferencia" ? "conferencia" : "listagem";
    setActiveTab(aba);
    syncInventoryTabToUrl(aba);
  }

  // Displays loader if report is initial loading, but remains interactive on fetches
  const isInitialLoading = isLoading && !report;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Inventário de Produtos</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-4xl">
              <strong className="text-primary">Sobre esta tela:</strong> a <strong>Listagem Geral</strong>{" "}
              mostra apenas produtos com controle de estoque ativado e pelo menos 1 unidade em estoque — os
              valores de mercadoria, custo e lucro estimado são calculados sobre o estoque atual. A{" "}
              <strong>Conferência de Produtos</strong> varre o catálogo inteiro, cadastro a cadastro, para
              acertar foto, dados, variações e o estoque físico.
            </p>
          </div>
          {activeTab === "listagem" && (
            <Button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white hover-elevate gap-2 shrink-0 self-start sm:self-center"
              disabled={isLoading}
            >
              <FileSpreadsheet className="h-4 w-4" /> Exportar Planilha
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={trocarAba}>
          <TabsList>
            <TabsTrigger value="listagem" className="gap-2">
              <List className="h-4 w-4" /> Listagem Geral
            </TabsTrigger>
            <TabsTrigger value="conferencia" className="gap-2">
              <ClipboardCheck className="h-4 w-4" /> Conferência de Produtos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listagem" className="mt-6 flex flex-col gap-6">
            <InventoryMetrics
              report={report}
              isLoading={isInitialLoading}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
            />

            <CategorySummary report={report} formatCurrency={formatCurrency} formatPercent={formatPercent} />

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
          </TabsContent>

          <TabsContent value="conferencia" className="mt-6">
            {/* Montada só quando a aba abre: a conferência consulta o servidor,
                e pagar por isso em quem veio ver o relatório seria desperdício. */}
            {activeTab === "conferencia" && <InventoryCountPanel />}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
