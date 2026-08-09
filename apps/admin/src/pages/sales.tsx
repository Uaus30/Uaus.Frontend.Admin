import React from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useSales } from "@/features/sales/hooks/useSales";
import { SalesTable } from "@/features/sales/components/SalesTable";
import { NewSaleModal } from "@/features/sales/components/NewSaleModal";
import { SaleDetailsModal } from "@/features/sales/components/SaleDetailsModal";

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
    customerId,
    setCustomerId,
    items,
    discount,
    setDiscount,
    payments,
    addPayment,
    removePayment,
    updatePayment,
    paidAmount,
    remainingAmount,
    notes,
    setNotes,
    selectedProductId,
    setSelectedProductId,
    selectedQty,
    setSelectedQty,
    savingSale,
    deletingSaleId,
    printingSaleId,
    availableProducts,
    subtotal,
    total,
    saleToView,
    resetSaleForm,
    addItem,
    removeItem,
    handleCreateSubmit,
    handleDeleteSale,
    handlePrintReceipt,
  } = useSales();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Vendas</h1>
            <p className="mt-1 text-muted-foreground">Histórico e registro de faturamento.</p>
          </div>
          <Button
            onClick={() => {
              resetSaleForm();
              setCreateModalOpen(true);
            }}
            className="bg-primary text-primary-foreground hover-elevate"
          >
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
          onDelete={handleDeleteSale}
          onPrintReceipt={handlePrintReceipt}
          deletingSaleId={deletingSaleId}
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
        customerId={customerId}
        setCustomerId={setCustomerId}
        customers={customers}
        availableProducts={availableProducts}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
        selectedQty={selectedQty}
        setSelectedQty={setSelectedQty}
        items={items}
        payments={payments}
        onAddPayment={addPayment}
        onRemovePayment={removePayment}
        onUpdatePayment={updatePayment}
        paidAmount={paidAmount}
        remainingAmount={remainingAmount}
        paymentMethods={paymentMethods}
        discount={discount}
        setDiscount={setDiscount}
        notes={notes}
        setNotes={setNotes}
        savingSale={savingSale}
        subtotal={subtotal}
        total={total}
        onAddItem={addItem}
        onRemoveItem={removeItem}
        onSubmit={handleCreateSubmit}
      />

      <SaleDetailsModal
        open={!!viewSaleId}
        onOpenChange={(open) => !open && setViewSaleId(null)}
        saleToView={saleToView}
        paymentMethodById={paymentMethodById}
        onPrintReceipt={handlePrintReceipt}
        printingSaleId={printingSaleId}
      />
    </AppLayout>
  );
}
