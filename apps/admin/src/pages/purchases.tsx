import { Plus } from "lucide-react";
import { monthNameOf } from "@workspace/core";
import { Button, ConfirmDialog } from "@workspace/ui";
import { usePurchases } from "@/features/purchases/hooks/usePurchases";
import { useMonthPurchaseBudget } from "@/features/purchases/hooks/useMonthPurchaseBudget";
import { useStatusRedBandGuard } from "@/features/purchases/hooks/useStatusRedBandGuard";
import { PurchaseBudgetBanner } from "@/features/purchases/components/PurchaseBudgetBanner";
import { PurchasesTable } from "@/features/purchases/components/PurchasesTable";
import { PurchaseEditorModal } from "@/features/purchases/components/PurchaseEditorModal";
import { PurchaseReceiveDialog } from "@/features/purchases/components/PurchaseReceiveDialog";
import { CancelReceiptDialog } from "@/features/purchases/components/CancelReceiptDialog";
import { ProductImageSearchModal } from "@/features/products/components/ProductImageSearchModal";

/**
 * Compras a fornecedor: o pedido, do registro ao lançamento no estoque.
 *
 * Renderiza o que `usePurchases` devolve. A busca de foto na web reaproveita a
 * modal do cadastro de produto — é o mesmo proxy e a mesma otimização.
 */
export default function Purchases() {
  const purchases = usePurchases();
  const monthBudget = useMonthPurchaseBudget();
  // "Marcar como a caminho" pelo menu da linha pergunta como o editor quando
  // leva o mês ao vermelho (decisão 13: pergunta, nunca bloqueia).
  const statusGuard = useStatusRedBandGuard(purchases.items, purchases.setStatus);
  const { form } = purchases;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Compras</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              O que foi (ou vai ser) comprado e ainda não entrou no estoque. Pendente em vermelho, a caminho
              em azul; ao receber, a compra vira uma entrada de estoque e fica verde.
            </p>
          </div>
          <Button onClick={form.openNew} className="bg-primary text-primary-foreground hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Registrar compra
          </Button>
        </div>

        {/* A faixa de compras do mês (23/11/2026): se o mês aguenta a próxima compra. */}
        <PurchaseBudgetBanner budget={monthBudget} />

        <PurchasesTable
          items={purchases.items}
          isLoading={purchases.isLoading}
          searchValue={purchases.searchValue}
          setSearch={purchases.setSearch}
          statusFilter={purchases.statusFilter}
          setStatusFilter={purchases.setStatusFilter}
          supplierFilter={purchases.supplierFilter}
          setSupplierFilter={purchases.setSupplierFilter}
          suppliers={purchases.suppliers}
          page={purchases.page}
          totalPages={purchases.totalPages}
          setPage={purchases.setPage}
          onEdit={form.openEdit}
          onDelete={purchases.remove}
          onSetStatus={statusGuard.request}
          onReceive={purchases.startReceive}
          onCancelReceipt={purchases.cancelReceipt.start}
          mutatingId={purchases.mutatingId}
        />
      </div>

      <ConfirmDialog
        open={statusGuard.pending !== null}
        onOpenChange={(aberto) => !aberto && statusGuard.cancel()}
        title="Comprar no vermelho?"
        description={`Com esta compra a caminho, ${monthNameOf(statusGuard.pending?.monthKey).toLowerCase() || "o mês"} não cobre os custos fixos. Marcar como a caminho mesmo assim?`}
        confirmLabel="Marcar mesmo assim"
        cancelLabel="Deixar pendente"
        destructive
        onConfirm={statusGuard.confirm}
      />

      <PurchaseEditorModal
        form={form}
        suppliers={purchases.suppliers}
        departments={purchases.departments}
        onCancelReceipt={purchases.cancelReceiptOfOpenPurchase}
      />

      <CancelReceiptDialog
        target={purchases.cancelReceipt.target}
        preview={purchases.cancelReceipt.preview}
        isLoadingPreview={purchases.cancelReceipt.isLoadingPreview}
        previewError={purchases.cancelReceipt.previewError}
        isRefreshingPreview={purchases.cancelReceipt.isRefreshingPreview}
        deleteGeneratedProduct={purchases.cancelReceipt.deleteGeneratedProduct}
        onDeleteGeneratedProductChange={purchases.cancelReceipt.setDeleteGeneratedProduct}
        onClose={purchases.cancelReceipt.close}
        onConfirm={purchases.cancelReceipt.confirm}
        isCancelling={purchases.cancelReceipt.isCancelling}
      />

      <PurchaseReceiveDialog
        purchase={purchases.receiving}
        form={purchases.receiveForm}
        onChange={purchases.updateReceiveForm}
        onItemChange={purchases.updateReceiveItem}
        onBrandChange={purchases.updateReceiveBrand}
        onBarcodeChange={purchases.updateReceiveBarcode}
        onAddItem={purchases.addReceiveItem}
        onCancel={purchases.cancelReceive}
        onConfirm={purchases.confirmReceive}
        onEditPurchase={purchases.editReceiving}
        isSaving={purchases.isReceiving}
        stockFrozen={purchases.stockFrozen}
        belowCostOpen={purchases.belowCostOpen}
        onConfirmBelowCost={purchases.confirmReceiveBelowCost}
        onCancelBelowCost={purchases.cancelReceiveBelowCost}
      />

      <ProductImageSearchModal
        productName={form.form.productName}
        barcode={form.form.productBarcode ?? undefined}
        isOpen={form.imageSearchOpen}
        onOpenChange={form.setImageSearchOpen}
        onSelectImage={form.addWebImage}
      />
    </>
  );
}
