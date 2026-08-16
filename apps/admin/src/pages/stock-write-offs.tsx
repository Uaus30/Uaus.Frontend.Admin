import { PackageMinus, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useStockWriteOffs } from "@/features/stock-write-offs/hooks/useStockWriteOffs";
import { StockWriteOffsTable } from "@/features/stock-write-offs/components/StockWriteOffsTable";
import { StockWriteOffDetailsModal } from "@/features/stock-write-offs/components/StockWriteOffDetailsModal";
import { RegisterStockWriteOffModal } from "@/features/stock-write-offs/components/RegisterStockWriteOffModal";
import { ReverseStockWriteOffDialog } from "@/features/stock-write-offs/components/ReverseStockWriteOffDialog";

/**
 * Página de Baixas de Estoque.
 *
 * Liga os componentes visuais ao `useStockWriteOffs`; nenhuma regra mora aqui.
 */
export default function StockWriteOffs() {
  const {
    writeOffs,
    writeOffsPage,
    isLoading,
    page,
    setPage,
    filters,
    setFilter,
    setPeriod,
    clearFilters,
    users,
    detailsId,
    setDetailsId,
    writeOffDetails,
    isLoadingDetails,
    registerModalOpen,
    setRegisterModalOpen,
    openRegisterModal,
    draftReason,
    setDraftReason,
    draftItems,
    draftNotes,
    setDraftNotes,
    draftTotalQuantity,
    addDraftItem,
    updateDraftItemQuantity,
    removeDraftItem,
    handleRegisterSubmit,
    isRegistering,
    reversalTarget,
    openReversal,
    closeReversal,
    reversalReason,
    setReversalReason,
    confirmReversal,
    isReversing,
  } = useStockWriteOffs();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackageMinus className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-display font-bold text-foreground">Baixas de Estoque</h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              Saídas de mercadoria sem venda: consumo, perda, doação e a falta apurada na contagem.
            </p>
          </div>
          <Button onClick={openRegisterModal} className="bg-primary text-primary-foreground hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Registrar Baixa
          </Button>
        </div>

        <StockWriteOffsTable
          writeOffs={writeOffs}
          writeOffsPage={writeOffsPage}
          isLoading={isLoading}
          filters={filters}
          onFilterChange={setFilter}
          onPeriodChange={setPeriod}
          onClearFilters={clearFilters}
          users={users}
          page={page}
          setPage={setPage}
          onViewDetails={setDetailsId}
          onReverse={openReversal}
        />
      </div>

      <RegisterStockWriteOffModal
        open={registerModalOpen}
        onOpenChange={setRegisterModalOpen}
        reason={draftReason}
        onReasonChange={setDraftReason}
        items={draftItems}
        onAddItem={addDraftItem}
        onUpdateItemQuantity={updateDraftItemQuantity}
        onRemoveItem={removeDraftItem}
        notes={draftNotes}
        onNotesChange={setDraftNotes}
        totalQuantity={draftTotalQuantity}
        isSaving={isRegistering}
        onSubmit={handleRegisterSubmit}
      />

      <StockWriteOffDetailsModal
        open={detailsId != null}
        onOpenChange={(open) => !open && setDetailsId(null)}
        writeOff={writeOffDetails}
        isLoading={isLoadingDetails}
        onReverse={openReversal}
      />

      <ReverseStockWriteOffDialog
        writeOff={reversalTarget}
        reason={reversalReason}
        onReasonChange={setReversalReason}
        onCancel={closeReversal}
        onConfirm={confirmReversal}
        isReversing={isReversing}
      />
    </AppLayout>
  );
}
