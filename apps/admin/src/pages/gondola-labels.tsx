import { AppLayout } from "@/components/layout";
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
    <AppLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Etiquetas de Gôndola</h1>
          <p className="mt-1 text-muted-foreground">
            Monte o lote, imprima em A4 (duas etiquetas por linha) e reimprima pelo histórico.
          </p>
        </div>

        <Tabs defaultValue="generate" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="generate">Gerar Etiquetas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="flex flex-col gap-6">
            <div className="grid items-start gap-6 lg:grid-cols-[340px,1fr]">
              <LabelProductSearch
                search={composer.search}
                setSearch={composer.setSearch}
                results={composer.searchResults}
                isLoading={composer.isSearching}
                onAdd={composer.addProduct}
              />
              <LabelItemsTable
                items={composer.items}
                description={composer.description}
                setDescription={composer.setDescription}
                totalLabels={composer.totalLabels}
                totalProducts={composer.totalProducts}
                printing={composer.printing}
                canGenerate={composer.canGenerate}
                onUpdate={composer.updateItem}
                onRemove={composer.removeItem}
                onClear={composer.clearItems}
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
    </AppLayout>
  );
}


