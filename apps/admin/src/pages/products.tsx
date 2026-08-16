import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { Plus } from "lucide-react";
import { useProductTable } from "@/features/products/hooks/useProductTable";
import { useProductEditor } from "@/features/products/hooks/useProductEditor";
import { ProductTable } from "@/features/products/components/ProductTable";
import { ProductEditorModal } from "@/features/products/components/ProductEditorModal";
import { ProductHistoryModal } from "@/features/products/components/ProductHistoryModal";
import { ProductImageSearchModal } from "@/features/products/components/ProductImageSearchModal";
import { useState } from "react";

export default function Products() {
  const table = useProductTable();
  const editor = useProductEditor();
  const [historyProductGroupId, setHistoryProductGroupId] = useState<number | null>(null);
  const [historyProductGroupName, setHistoryProductGroupName] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [searchImageProduct, setSearchImageProduct] = useState<any | null>(null);

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Produtos</h1>
          </div>
          <Button
            onClick={() => editor.openModal()}
            className="bg-primary text-primary-foreground hover-elevate"
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>

        <ProductTable
          isLoading={table.isLoading}
          search={table.search}
          setSearch={table.setSearch}
          page={table.page}
          setPage={table.setPage}
          limit={table.limit}
          setLimit={table.setLimit}
          totalPages={table.totalPages}
          productPageTotal={table.productPage?.total || 0}
          enrichedProducts={table.enrichedProducts}
          statusOptions={table.statusOptions}
          onEdit={editor.openModal}
          onDelete={(product) => {
            void editor.handleDeleteProductGroup(product.productGroupId);
          }}
          onViewHistory={(product) => {
            setHistoryProductGroupId(product.productGroupId);
            setHistoryProductGroupName(product.productGroup?.name || product.name);
            setHistoryModalOpen(true);
          }}
          onUpdatePrice={table.updateProductPrice}
          updatingPriceId={table.updatingPriceId}
          onUpdateStock={table.updateProductStock}
          updatingStockId={table.updatingStockId}
          onSearchInternetImage={setSearchImageProduct}
        />
      </div>

      <ProductEditorModal editor={editor} />
      <ProductHistoryModal
        productGroupId={historyProductGroupId}
        productGroupName={historyProductGroupName}
        isOpen={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
      />
      <ProductImageSearchModal
        productName={searchImageProduct?.name || ""}
        barcode={searchImageProduct?.barcode}
        isOpen={searchImageProduct !== null}
        onOpenChange={(open) => !open && setSearchImageProduct(null)}
        onSelectImage={async (imageUrl) => {
          if (searchImageProduct) {
            await table.saveWebImageAsPrincipal(searchImageProduct, imageUrl);
          }
        }}
      />
    </AppLayout>
  );
}
