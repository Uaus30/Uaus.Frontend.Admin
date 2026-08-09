import React from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useStockEntries } from "@/features/stock-entries/hooks/useStockEntries";
import { StockEntriesTable } from "@/features/stock-entries/components/StockEntriesTable";
import { StockEntryDetailsModal } from "@/features/stock-entries/components/StockEntryDetailsModal";
import { NewStockEntryModal } from "@/features/stock-entries/components/NewStockEntryModal";

/**
 * StockEntries Page Component
 * 
 * Renders the Stock Entries admin panel, connecting page-level actions
 * to the useStockEntries state manager hook and extracted subcomponents.
 */
export default function StockEntries() {
  const {
    page,
    setPage,
    selectedEntryId,
    detailsModalOpen,
    setDetailsModalOpen,
    newEntryModalOpen,
    setNewEntryModalOpen,
    selectedSupplierFilter,
    setSelectedSupplierFilter,
    supplierId,
    setSupplierId,
    invoiceNumber,
    setInvoiceNumber,
    entryDate,
    setEntryDate,
    notes,
    setNotes,
    items,
    entriesData,
    isLoadingEntries,
    entryDetails,
    isLoadingDetails,
    suppliers,
    products,
    isSavingEntry,
    resetNewEntryForm,
    handleAddEmptyItem,
    handleRemoveItem,
    handleItemChange,
    handleSaveEntry,
    handleViewDetails,
    formatCurrency,
    formatShortDate,
    deleteEntry,
  } = useStockEntries();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Entradas de Estoque</h1>
            <p className="text-sm text-muted-foreground">
              Registre recebimentos de mercadorias para atualizar o estoque e preços dos produtos.
            </p>
          </div>
          <Button
            onClick={() => {
              resetNewEntryForm();
              setNewEntryModalOpen(true);
            }}
            className="bg-primary text-primary-foreground hover-elevate gap-2"
          >
            <Plus className="h-4 w-4" /> Registrar Entrada
          </Button>
        </div>

        <StockEntriesTable
          entriesData={entriesData}
          isLoadingEntries={isLoadingEntries}
          suppliers={suppliers}
          selectedSupplierFilter={selectedSupplierFilter}
          setSelectedSupplierFilter={setSelectedSupplierFilter}
          page={page}
          setPage={setPage}
          onViewDetails={handleViewDetails}
          formatCurrency={formatCurrency}
          formatShortDate={formatShortDate}
        />
      </div>

      <StockEntryDetailsModal
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        selectedEntryId={selectedEntryId}
        entryDetails={entryDetails}
        isLoadingDetails={isLoadingDetails}
        formatCurrency={formatCurrency}
        formatShortDate={formatShortDate}
        onDelete={deleteEntry}
      />

      <NewStockEntryModal
        open={newEntryModalOpen}
        onOpenChange={setNewEntryModalOpen}
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        invoiceNumber={invoiceNumber}
        setInvoiceNumber={setInvoiceNumber}
        entryDate={entryDate}
        setEntryDate={setEntryDate}
        notes={notes}
        setNotes={setNotes}
        items={items}
        suppliers={suppliers}
        products={products}
        isSavingEntry={isSavingEntry}
        onAddEmptyItem={handleAddEmptyItem}
        onRemoveItem={handleRemoveItem}
        onItemChange={handleItemChange}
        onSubmit={handleSaveEntry}
      />
    </AppLayout>
  );
}


