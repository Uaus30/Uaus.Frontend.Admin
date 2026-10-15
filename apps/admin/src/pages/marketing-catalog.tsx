import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui";
import { Megaphone } from "lucide-react";
import { CatalogControls } from "@/features/marketing-catalog/components/CatalogControls";
import { CatalogProductList } from "@/features/marketing-catalog/components/CatalogProductList";
import { CatalogProductPicker } from "@/features/marketing-catalog/components/CatalogProductPicker";
import { CustomCatalogControls } from "@/features/marketing-catalog/components/CustomCatalogControls";
import { CustomSelectionList } from "@/features/marketing-catalog/components/CustomSelectionList";
import { PieceOutput } from "@/features/marketing-catalog/components/PieceOutput";
import { useCatalogGenerator } from "@/features/marketing-catalog/hooks/useCatalogGenerator";
import { useCatalogProductSearch } from "@/features/marketing-catalog/hooks/useCatalogProductSearch";
import { useCustomCatalog } from "@/features/marketing-catalog/hooks/useCustomCatalog";
import { PIECE_SPECS } from "@/features/marketing-catalog/template/geometry";

/**
 * Catálogo de divulgação (rota `/marketing/catalogo`).
 *
 * Duas abas, cada uma com a sua peça: o Automático (o sistema sorteia) e o
 * Personalizado (a pessoa escolhe os produtos um a um, desde 15/10/2026). Os
 * hooks moram na página, e não dentro das abas, para alternar entre elas não
 * apagar a peça nem a lista da outra.
 */
export default function MarketingCatalogPage() {
  const generator = useCatalogGenerator();
  const custom = useCustomCatalog();
  const search = useCatalogProductSearch();
  const { piece, isGenerating } = generator;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Catálogo de divulgação
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          No Automático o sistema sorteia os produtos e monta a peça pronta: banner em imagem para o status do
          WhatsApp e o story do Instagram, ou catálogo em PDF para os grupos. No Personalizado, você escolhe
          os produtos do banner um a um.
        </p>
      </div>

      <Tabs defaultValue="automatic" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="automatic">Automático</TabsTrigger>
          <TabsTrigger value="custom">Personalizado</TabsTrigger>
        </TabsList>

        <TabsContent value="automatic">
          {/* A ordem no código é a do celular, que é uma coluna só: escolher e gerar,
              ver a prévia, compartilhar, e por fim trocar produto. No computador a
              prévia sobe para a coluna da direita sem mudar essa ordem.
              `min-w-0`: item de grid não encolhe abaixo do próprio conteúdo, e o
              nome comprido da lista alargava a coluna além da tela do celular. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              <CatalogControls
                formats={generator.formats}
                format={generator.format}
                onFormatChange={generator.selectFormat}
                themes={generator.themes}
                theme={generator.theme}
                onThemeChange={generator.selectTheme}
                isLoadingThemes={generator.isLoadingThemes}
                themesFailed={generator.themesFailed}
                title={generator.title}
                onTitleChange={generator.setTitle}
                hasPiece={generator.pieceMatchesFormat}
                isGenerating={isGenerating}
                titleChanged={generator.titleChanged}
                onGenerate={generator.generate}
                onApplyTitle={generator.applyTitle}
              />
            </div>

            <div className="min-w-0 space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <PieceOutput
                status={generator.status}
                format={generator.format}
                piece={piece}
                progress={generator.progress}
                busyNoun={generator.busyNoun}
                errorMessage={generator.errorMessage}
                canShare={generator.canShare}
                isGenerating={isGenerating}
                onShare={generator.share}
                onDownload={generator.download}
              />
            </div>

            {piece && (
              <div className="min-w-0 lg:col-start-1 lg:row-start-2">
                <CatalogProductList
                  products={piece.products}
                  noun={piece.format.noun}
                  pageSize={PIECE_SPECS[piece.format.piece].maxProducts}
                  isGenerating={isGenerating}
                  selectedIds={generator.selectedIds}
                  onToggle={generator.toggleSelected}
                  onClearSelection={generator.clearSelection}
                  onSwapSelected={() => generator.swap(generator.selectedIds)}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="custom">
          {/* Mesma lógica de ordem: formato e título, buscar e montar a lista,
              gerar no pé dela, e só então a prévia (à direita no computador). */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
              <CustomCatalogControls
                formats={custom.formats}
                format={custom.format}
                onFormatChange={custom.selectFormat}
                title={custom.title}
                onTitleChange={custom.setTitle}
              />
              <CatalogProductPicker
                search={search.search}
                setSearch={search.setSearch}
                onSubmit={search.submit}
                onClear={search.clear}
                onScanCode={search.searchNow}
                results={search.results}
                isLoading={search.isSearching}
                hasSearched={search.hasSearched}
                hasFailed={search.hasFailed}
                selectedIds={custom.items.map((item) => item.productGroupId)}
                isFull={custom.items.length >= custom.capacity}
                onAdd={custom.add}
              />
              <CustomSelectionList
                items={custom.items}
                capacity={custom.capacity}
                formatLabel={custom.format.label}
                unavailable={custom.unavailable}
                disabled={custom.isGenerating}
                blocker={custom.blocker}
                hasPiece={custom.piece !== null}
                onGenerate={custom.generate}
                onRename={custom.rename}
                onMove={custom.move}
                onRemove={custom.remove}
                onClear={custom.clear}
              />
            </div>

            <div className="min-w-0 space-y-3 lg:col-start-2 lg:row-start-1">
              <PieceOutput
                status={custom.status}
                format={custom.format}
                piece={custom.piece}
                progress={custom.progress}
                busyNoun={custom.busyNoun}
                errorMessage={custom.errorMessage}
                canShare={custom.canShare}
                isGenerating={custom.isGenerating}
                onShare={custom.share}
                onDownload={custom.download}
                emptyHint="Escolha os produtos, escreva o título e toque em Gerar banner."
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
