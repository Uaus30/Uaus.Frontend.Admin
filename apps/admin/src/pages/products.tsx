import { useState } from "react";
import { Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useProductTable } from "@/features/products/hooks/useProductTable";
import { useProductEditor } from "@/features/products/hooks/useProductEditor";
import { useProductDeepLink } from "@/features/products/hooks/useProductDeepLink";
import { useProductDetailFromUrl } from "@/features/products/hooks/useProductDetailFromUrl";
import { useProductDetailHistory } from "@/features/products/hooks/useProductDetailHistory";
import { ProductTable } from "@/features/products/components/ProductTable";
import { ProductDetailScreen } from "@/features/products/components/detail/ProductDetailScreen";
import { ProductDetailDiscardDialog } from "@/features/products/components/detail/ProductDetailDiscardDialog";
import { ProductHistoryModal } from "@/features/products/components/ProductHistoryModal";
import { ProductImageSearchModal } from "@/features/products/components/ProductImageSearchModal";
import type { ProductTableRow } from "@/features/products/types";

/**
 * Página de Produtos: a listagem e, no lugar dela, o detalhe do produto.
 *
 * O cadastro era uma modal sobre a lista; virou TELA em 30/08/2026 (ver
 * `features/products/components/detail/ProductDetailScreen.tsx`). A troca é
 * feita aqui, por `editor.detailOpen`, e não por rota nova: a lista continua
 * montada por trás, com filtro, página e busca intactos, e voltar do detalhe
 * devolve a pessoa exatamente onde ela estava. Uma rota `/produtos/:id`
 * remontaria a listagem do zero a cada volta — e o link direto do PDV
 * (`?busca=&editar=`) precisaria ser reescrito por nada.
 *
 * O que a tela empresta do navegador mora nos hooks, não aqui: `?id=` na barra
 * de endereços e voltar fechando o detalhe (`useProductDetailHistory`), o mesmo
 * `?id=` reabrindo o produto em quem chega por link (`useProductDetailFromUrl`)
 * e o aviso de alterações não salvas antes de sair (`isDirty` do editor).
 */
export default function Products() {
  const table = useProductTable();
  const editor = useProductEditor();
  const [historyProductGroupId, setHistoryProductGroupId] = useState<number | null>(null);
  const [historyProductGroupName, setHistoryProductGroupName] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [searchImageProduct, setSearchImageProduct] = useState<ProductTableRow | null>(null);
  // Saída suspensa esperando a confirmação de descartar alterações. `"history"`
  // é o voltar do navegador; `"ui"`, os botões da própria tela.
  const [pendingClose, setPendingClose] = useState<null | "ui" | "history">(null);
  // Aba em que o detalhe abre. O menu "Estoque" da listagem cai direto na aba
  // de lançamento; todos os outros caminhos continuam abrindo em Dados.
  const [detailInitialTab, setDetailInitialTab] = useState<"dados" | "estoque">("dados");

  function abrirDetalhe(product?: ProductTableRow, aba: "dados" | "estoque" = "dados") {
    setDetailInitialTab(aba);
    editor.openDetail(product);
  }

  // Link direto do PDV: `/produtos?busca=<grupo>&editar=<id>` abre o detalhe do
  // produto assim que a listagem filtrada chega.
  useProductDeepLink({
    isLoading: table.isLoading,
    enrichedProducts: table.enrichedProducts,
    openDetail: editor.openDetail,
  });

  // Quem chega em `/produtos?id=<grupo>` (recarga ou link compartilhado) cai
  // direto no detalhe do produto prometido pela URL.
  useProductDetailFromUrl({ openDetail: editor.openDetail });

  function fecharDetalhe() {
    setPendingClose(null);
    editor.setDetailOpen(false);
    editor.resetForm();
  }

  function pedirParaFechar() {
    if (editor.isDirty) {
      setPendingClose("ui");
      return;
    }
    fecharDetalhe();
  }

  useProductDetailHistory({
    open: editor.detailOpen,
    productId: editor.editingGroupId,
    isDirty: editor.isDirty,
    close: fecharDetalhe,
    interceptClose: () => setPendingClose("history"),
  });

  if (editor.detailOpen) {
    return (
      <AppLayout>
        <ProductDetailScreen editor={editor} initialTab={detailInitialTab} onRequestClose={pedirParaFechar} />
        <ProductDetailDiscardDialog
          open={pendingClose !== null}
          onCancel={() => setPendingClose(null)}
          onConfirm={fecharDetalhe}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Produtos</h1>
          </div>
          <Button onClick={() => abrirDetalhe()} className="bg-primary text-primary-foreground hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>

        <ProductTable
          isLoading={table.isLoading}
          search={table.search}
          setSearch={table.setSearch}
          departmentId={table.departmentId}
          setDepartmentId={table.setDepartmentId}
          departments={table.departments}
          categoryId={table.categoryId}
          setCategoryId={table.setCategoryId}
          categories={table.categories}
          status={table.status}
          setStatus={table.setStatus}
          statusOptions={table.statusOptions}
          onResetFilters={table.resetFilters}
          page={table.page}
          setPage={table.setPage}
          limit={table.limit}
          setLimit={table.setLimit}
          totalPages={table.totalPages}
          productPageTotal={table.productPage?.total || 0}
          enrichedProducts={table.enrichedProducts}
          onEdit={(product) => abrirDetalhe(product)}
          onOpenStock={(product) => abrirDetalhe(product, "estoque")}
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
          onSearchInternetImage={setSearchImageProduct}
        />
      </div>

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
