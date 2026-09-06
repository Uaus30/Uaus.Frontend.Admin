import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@workspace/ui";
import { useProductTable } from "@/features/products/hooks/useProductTable";
import { useProductEditor } from "@/features/products/hooks/useProductEditor";
import { useProductDetailFromUrl } from "@/features/products/hooks/useProductDetailFromUrl";
import { useProductDetailHistory } from "@/features/products/hooks/useProductDetailHistory";
import { detailTabFromUrl, stockProductIdFromUrl } from "@/features/products/product-detail-route";
import { ProductTable } from "@/features/products/components/ProductTable";
import { ProductDetailScreen } from "@/features/products/components/detail/ProductDetailScreen";
import { ProductDetailDiscardDialog } from "@/features/products/components/detail/ProductDetailDiscardDialog";
import { ProductHistoryModal } from "@/features/products/components/ProductHistoryModal";
import { ProductImageSearchModal } from "@/features/products/components/ProductImageSearchModal";
import type { ProductTableRow } from "@/features/products/types";
import { LowStockAlert } from "@/features/low-stock/components/LowStockAlert";

/**
 * Página de Produtos: a listagem e, no lugar dela, o detalhe do produto.
 *
 * O cadastro era uma modal sobre a lista; virou TELA em 30/08/2026 (ver
 * `features/products/components/detail/ProductDetailScreen.tsx`) e ganhou rota
 * própria em 01/09/2026: `/produtos/<grupo>/detalhes`.
 *
 * Quem troca o que aparece continua sendo o `editor.detailOpen`, e a rota do
 * detalhe divide a entrada do `<Switch>` com a da listagem — as duas casam no
 * mesmo `<Route>` (ver `features/products/product-detail-route.ts`). É isso que
 * mantém a lista montada por trás, com filtro, página e busca intactos: com uma
 * entrada de rota para cada caminho, ir para o detalhe desmontaria a página e
 * voltar devolveria a pessoa a uma listagem recém-nascida.
 *
 * O que a tela empresta do navegador mora nos hooks, não aqui: o caminho na
 * barra de endereços e o voltar fechando o detalhe (`useProductDetailHistory`),
 * a abertura de quem chega por link (`useProductDetailFromUrl`, que também
 * responde pelo `?id=` de antes da rota e pelo `?editar=` do PDV) e o aviso de
 * alterações não salvas antes de sair (`isDirty` do editor).
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
  // Quem chega por `?aba=estoque` (o recebimento de uma compra) abre direto
  // nas entradas; os demais caminhos continuam em Dados.
  const [detailInitialTab, setDetailInitialTab] = useState<"dados" | "estoque">(detailTabFromUrl);
  // Variação que a aba de Estoque abre, quando a URL diz qual.
  const [detailStockProductId, setDetailStockProductId] = useState<number | null>(stockProductIdFromUrl);

  function abrirDetalhe(product?: ProductTableRow, aba: "dados" | "estoque" = "dados") {
    setDetailInitialTab(aba);
    // Abrir OUTRO produto pela listagem apaga a variação que veio da URL: ela
    // valia para o produto daquele link, não para este.
    setDetailStockProductId(null);
    editor.openDetail(product);
  }

  // Quem chega por link cai direto no detalhe: a rota `/produtos/<grupo>/
  // detalhes`, o `?id=` de antes dela, e o `?editar=<produto>` do PDV e das
  // Etiquetas. O `resolvendo` segura a listagem enquanto isso.
  const { resolvendo: resolvendoDetalheDaUrl } = useProductDetailFromUrl({
    openDetail: editor.openDetail,
    openDetailFromPurchase: editor.openDetailFromPurchase,
  });

  // Com o detalhe aberto, o histórico ganha o NOME do produto no lugar de
  // "Produtos" — é o que distingue as cinco abas de cadastro que ficam abertas
  // ao mesmo tempo. Cadastro novo ainda não tem nome; até ganhar um, "Novo
  // produto" diz mais do que o nome da listagem.
  usePageTitle(editor.detailOpen ? editor.form.productGroupName.trim() || "Novo produto" : undefined);

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

  // A URL prometeu um detalhe: desenhar a listagem aqui seria mostrar por um
  // instante a tela que já se sabe que vai ser substituída.
  if (resolvendoDetalheDaUrl && !editor.detailOpen) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (editor.detailOpen) {
    return (
      <AppLayout>
        <ProductDetailScreen
          editor={editor}
          initialTab={detailInitialTab}
          initialStockProductId={detailStockProductId}
          onRequestClose={pedirParaFechar}
        />
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
          <div className="flex flex-wrap items-center gap-3">
            {/* Vermelho só com pendência; leva ao relatório de estoque baixo. */}
            <LowStockAlert variant="compact" />
            <Button
              onClick={() => abrirDetalhe()}
              className="bg-primary text-primary-foreground hover-elevate"
            >
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </div>
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
