import { Button } from "@workspace/ui";
import { Download, Megaphone, Share2 } from "lucide-react";
import { CatalogBannerPreview } from "@/features/marketing-catalog/components/CatalogBannerPreview";
import { CatalogControls } from "@/features/marketing-catalog/components/CatalogControls";
import { CatalogProductList } from "@/features/marketing-catalog/components/CatalogProductList";
import { useCatalogGenerator } from "@/features/marketing-catalog/hooks/useCatalogGenerator";

/** Catálogo de divulgação (rota `/marketing/catalogo`). */
export default function MarketingCatalogPage() {
  const generator = useCatalogGenerator();
  const { banner, isGenerating } = generator;

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
          O sistema sorteia os produtos e monta a imagem pronta para o status do WhatsApp e o story do
          Instagram. Cada geração sai diferente da anterior.
        </p>
      </div>

      {/* A ordem no código é a do celular, que é uma coluna só: escolher e gerar,
          ver a prévia, compartilhar, e por fim trocar produto. No computador a
          prévia sobe para a coluna da direita sem mudar essa ordem.
          `min-w-0`: item de grid não encolhe abaixo do próprio conteúdo, e o
          nome comprido da lista alargava a coluna além da tela do celular. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <CatalogControls
            themes={generator.themes}
            theme={generator.theme}
            onThemeChange={generator.selectTheme}
            isLoadingThemes={generator.isLoadingThemes}
            themesFailed={generator.themesFailed}
            title={generator.title}
            onTitleChange={generator.setTitle}
            hasBanner={banner !== null}
            isGenerating={isGenerating}
            titleChanged={generator.titleChanged}
            onGenerate={generator.generate}
            onApplyTitle={generator.applyTitle}
          />
        </div>

        <div className="min-w-0 space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <CatalogBannerPreview
            status={generator.status}
            previewUrl={banner?.previewUrl}
            errorMessage={generator.errorMessage}
          />

          {banner && (
            <div className="mx-auto flex w-full max-w-[360px] flex-col gap-2 sm:flex-row">
              {generator.canShare && (
                <Button onClick={generator.share} disabled={isGenerating} className="flex-1 gap-2">
                  <Share2 className="h-4 w-4" /> Compartilhar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={generator.download}
                disabled={isGenerating}
                className="flex-1 gap-2"
              >
                <Download className="h-4 w-4" /> Baixar
              </Button>
            </div>
          )}
        </div>

        {banner && (
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <CatalogProductList
              products={banner.products}
              isGenerating={isGenerating}
              onSwap={generator.swap}
            />
          </div>
        )}
      </div>
    </div>
  );
}
