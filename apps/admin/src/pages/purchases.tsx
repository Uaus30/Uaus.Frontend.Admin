import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { usePurchases } from "@/features/purchases/hooks/usePurchases";
import { PurchasesTable } from "@/features/purchases/components/PurchasesTable";
import { PurchaseEditorModal } from "@/features/purchases/components/PurchaseEditorModal";
import { PurchaseReceiveDialog } from "@/features/purchases/components/PurchaseReceiveDialog";
import { ProductImageSearchModal } from "@/features/products/components/ProductImageSearchModal";

/**
 * Compras a fornecedor: o pedido, do registro ao lançamento no estoque.
 *
 * Renderiza o que `usePurchases` devolve. A busca de foto na web reaproveita a
 * modal do cadastro de produto — é o mesmo proxy e a mesma otimização.
 */
export default function Purchases() {
  const purchases = usePurchases();
  const { form } = purchases;

  return (
    <AppLayout>
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

        <PurchasesTable
          items={purchases.items}
          isLoading={purchases.isLoading}
          searchValue={purchases.searchValue}
          setSearch={purchases.setSearch}
          statusFilter={purchases.statusFilter}
          setStatusFilter={purchases.setStatusFilter}
          page={purchases.page}
          totalPages={purchases.totalPages}
          setPage={purchases.setPage}
          onEdit={form.openEdit}
          onDelete={purchases.remove}
          onSetStatus={purchases.setStatus}
          onReceive={purchases.startReceive}
          mutatingId={purchases.mutatingId}
        />
      </div>

      <PurchaseEditorModal form={form} suppliers={purchases.suppliers} />

      <PurchaseReceiveDialog
        purchase={purchases.receiving}
        form={purchases.receiveForm}
        onChange={purchases.updateReceiveForm}
        onCancel={purchases.cancelReceive}
        onConfirm={purchases.confirmReceive}
        isSaving={purchases.isReceiving}
      />

      <ProductImageSearchModal
        productName={form.form.productName}
        barcode={form.form.productBarcode ?? undefined}
        isOpen={form.imageSearchOpen}
        onOpenChange={form.setImageSearchOpen}
        onSelectImage={form.addWebImage}
      />
    </AppLayout>
  );
}
