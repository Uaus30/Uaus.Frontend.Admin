import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@workspace/ui";
import { useSales } from "@/features/sales/hooks/useSales";
import { SalesTable } from "@/features/sales/components/SalesTable";
import { NewSaleModal } from "@/features/sales/components/NewSaleModal";
import { SaleDetailsModal } from "@/features/sales/components/SaleDetailsModal";
import { EditSaleHeaderModal } from "@/features/sales/components/EditSaleHeaderModal";
import { CancelSaleDialog } from "@/features/sales/components/CancelSaleDialog";

/**
 * Sales Page Component
 *
 * Renders the Sales administration panel layout, connecting visual listings
 * and checkout dialogs to the useSales state manager hook.
 */
export default function Sales() {
  const {
    page,
    setPage,
    createModalOpen,
    setCreateModalOpen,
    viewSaleId,
    setViewSaleId,
    salesPage,
    isLoading,
    customers,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentMethodFilter,
    setPaymentMethodFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    paymentMethods,
    paymentStatuses,
    paymentMethodById,
    saleDetails,
    newSale,
    openNewSale,
    saleToEdit,
    setSaleToEdit,
    saleToCancel,
    setSaleToCancel,
    cancelClosedPeriodNotice,
    cancellingSaleId,
    printingSaleId,
    saleToView,
    handleCancelSale,
    handlePrintReceipt,
  } = useSales();

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Vendas</h1>
            <p className="mt-1 text-muted-foreground">Histórico e registro de faturamento.</p>
          </div>
          <Button onClick={openNewSale} className="bg-primary text-primary-foreground hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Nova Venda
          </Button>
        </div>

        <SalesTable
          isLoading={isLoading}
          saleDetails={saleDetails}
          paymentMethodById={paymentMethodById}
          page={page}
          setPage={setPage}
          salesPage={salesPage}
          onViewDetails={setViewSaleId}
          onCancel={setSaleToCancel}
          onPrintReceipt={handlePrintReceipt}
          cancellingSaleId={cancellingSaleId}
          printingSaleId={printingSaleId}
          search={search}
          setSearch={setSearch}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          paymentMethodFilter={paymentMethodFilter}
          setPaymentMethodFilter={setPaymentMethodFilter}
          paymentStatusFilter={paymentStatusFilter}
          setPaymentStatusFilter={setPaymentStatusFilter}
          paymentMethods={paymentMethods}
          paymentStatuses={paymentStatuses}
        />
      </div>

      <NewSaleModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        draft={newSale}
        customers={customers}
        paymentMethods={paymentMethods}
      />

      <SaleDetailsModal
        open={!!viewSaleId}
        onOpenChange={(open) => !open && setViewSaleId(null)}
        saleToView={saleToView}
        paymentMethodById={paymentMethodById}
        onPrintReceipt={handlePrintReceipt}
        printingSaleId={printingSaleId}
        onEdit={(sale) => {
          // A correção abre no lugar do detalhe: dois diálogos empilhados no
          // celular, um em tela cheia sobre o outro, confundem o voltar.
          setViewSaleId(null);
          setSaleToEdit(sale);
        }}
        onCancelSale={(sale) => {
          // Mesmo motivo: no celular, um diálogo por vez.
          setViewSaleId(null);
          setSaleToCancel(sale);
        }}
      />

      <CancelSaleDialog
        sale={saleToCancel}
        cancelling={cancellingSaleId !== null}
        closedPeriodNotice={cancelClosedPeriodNotice}
        onClose={() => setSaleToCancel(null)}
        onConfirm={(reason) => void handleCancelSale(reason)}
      />

      <EditSaleHeaderModal
        sale={saleToEdit}
        onClose={() => setSaleToEdit(null)}
        customers={customers}
        paymentMethods={paymentMethods}
      />
    </>
  );
}
