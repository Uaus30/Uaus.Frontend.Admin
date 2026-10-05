import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui";
import { LabelBatchDeleteDialog } from "@/features/gondola-labels/components/LabelBatchDeleteDialog";
import { LabelBatchDetailsModal } from "@/features/gondola-labels/components/LabelBatchDetailsModal";
import { LabelBatchHistoryTable } from "@/features/gondola-labels/components/LabelBatchHistoryTable";
import { LabelItemsTable } from "@/features/gondola-labels/components/LabelItemsTable";
import { LabelPreviewCard } from "@/features/gondola-labels/components/LabelPreviewCard";
import { LabelProductSearch } from "@/features/gondola-labels/components/LabelProductSearch";
import { useLabelBatchHistory } from "@/features/gondola-labels/hooks/useLabelBatchHistory";
import { useLabelComposer } from "@/features/gondola-labels/hooks/useLabelComposer";

/**
 * Página de Etiquetas de Gôndola: monta e imprime lotes de etiquetas de preço
 * em A4 (duas colunas) e mantém o histórico com reimpressão fiel.
 */
export default function GondolaLabels() {
  const composer = useLabelComposer();
  const history = useLabelBatchHistory();

  return (
    <>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground sm:text-3xl">Etiquetas</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Monte o lote (no celular, pela câmera, se quiser), imprima em A4 e reimprima pelo histórico.
          </p>
        </div>

        <Tabs defaultValue="generate" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="generate">Gerar Etiquetas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="flex flex-col gap-6">
            <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[340px_1fr] [&>*]:min-w-0">
              <LabelProductSearch
                search={composer.search}
                setSearch={composer.setSearch}
                onSubmit={composer.submitSearch}
                results={composer.searchResults}
                isLoading={composer.isSearching}
                hasSearched={composer.hasSearched}
                hasFailed={composer.searchFailed}
                onAdd={composer.addProduct}
                onScanCode={composer.addByBarcode}
                disabled={!composer.canEdit}
                priceOf={composer.searchResultShelf}
              />
              <LabelItemsTable
                items={composer.items}
                description={composer.description}
                setDescription={composer.setDescription}
                totalLabels={composer.totalLabels}
                totalProducts={composer.totalProducts}
                printing={composer.printing}
                canGenerate={composer.canGenerate}
                disabled={!composer.canEdit}
                draft={{
                  loadState: composer.draftLoadState,
                  saveState: composer.draftSaveState,
                  savedAt: composer.draftSavedAt,
                  onRetryLoad: composer.retryDraftLoad,
                  onRetrySave: () => void composer.retryDraftSave(),
                }}
                onUpdate={composer.updateItem}
                onRemove={composer.removeItem}
                onClear={composer.clearBatch}
                onGenerate={composer.handleGenerate}
              />
            </div>

            {composer.previewLabels.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-foreground">Pré-visualização</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {composer.previewLabels.map((label, index) => (
                    <LabelPreviewCard key={index} label={label} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <LabelBatchHistoryTable
              batchPage={history.batchPage}
              isLoading={history.isLoading}
              page={history.page}
              setPage={history.setPage}
              limit={history.limit}
              setLimit={history.setLimit}
              totalPages={history.totalPages}
              reprintingId={history.reprintingId}
              onViewDetails={history.setDetailsId}
              onReprint={history.handleReprint}
              onDeleteRequest={history.setDeleteTarget}
            />
          </TabsContent>
        </Tabs>
      </div>

      <LabelBatchDetailsModal
        open={history.detailsId !== null}
        onOpenChange={(open) => !open && history.setDetailsId(null)}
        batch={history.detailsBatch}
        isLoading={history.isDetailsLoading}
        reprinting={history.reprintingId !== null}
        onReprint={history.handleReprint}
      />

      <LabelBatchDeleteDialog
        batch={history.deleteTarget}
        deleting={history.deleting}
        onCancel={() => history.setDeleteTarget(null)}
        onConfirm={history.handleDelete}
      />
    </>
  );
}
