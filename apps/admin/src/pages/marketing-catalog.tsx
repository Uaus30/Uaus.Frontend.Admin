import { Button } from "@workspace/ui";
import { Download, Megaphone, RefreshCw, Share2, Sparkles } from "lucide-react";
import { CatalogBannerPreview } from "@/features/marketing-catalog/components/CatalogBannerPreview";
import { STORY_TITLE, useCatalogGenerator } from "@/features/marketing-catalog/hooks/useCatalogGenerator";

/** Catálogo de divulgação (rota `/marketing/catalogo`). */
export default function MarketingCatalogPage() {
  const { status, banner, errorMessage, isGenerating, canShare, generate, share, download } =
    useCatalogGenerator();

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
        <CatalogBannerPreview status={status} previewUrl={banner?.previewUrl} errorMessage={errorMessage} />

        {/* `min-w-0`: item de grid não encolhe abaixo do próprio conteúdo, e o nome
            comprido da lista (que não quebra linha) alargava a coluna além da
            tela do celular — a prévia e os botões saíam cortados. */}
        <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Banner 9:16</p>
            <p className="text-lg font-semibold text-foreground">{STORY_TITLE}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ofertas vigentes e os cadastros mais recentes do site, com foto. O preço impresso é o de agora.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={generate} disabled={isGenerating} className="gap-2">
              {banner ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {banner ? "Sortear de novo" : "Gerar banner"}
            </Button>

            {banner && canShare && (
              <Button variant="outline" onClick={share} disabled={isGenerating} className="gap-2">
                <Share2 className="h-4 w-4" /> Compartilhar
              </Button>
            )}

            {banner && (
              <Button variant="outline" onClick={download} disabled={isGenerating} className="gap-2">
                <Download className="h-4 w-4" /> Baixar
              </Button>
            )}
          </div>

          {banner && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Produtos neste banner ({banner.products.length})
              </p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {banner.products.map((product) => (
                  <li key={product.productGroupId} className="truncate">
                    {product.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
