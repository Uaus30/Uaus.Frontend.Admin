import { ImageIcon, Loader2 } from "lucide-react";
import type { GeneratorStatus } from "../hooks/useCatalogGenerator";

interface CatalogBannerPreviewProps {
  status: GeneratorStatus;
  /** URL do banner pronto. Ausente antes da primeira geração. */
  previewUrl?: string;
  errorMessage?: string | null;
}

/**
 * A moldura 9:16 da prévia.
 *
 * O que aparece aqui É o arquivo que será compartilhado, e não uma simulação em
 * HTML: a prévia e o banner não têm como divergir. Durante uma nova geração o
 * banner anterior continua visível, esmaecido — trocar por um espaço vazio faria
 * a tela pular a cada "Sortear de novo".
 */
export function CatalogBannerPreview({ status, previewUrl, errorMessage }: CatalogBannerPreviewProps) {
  const isGenerating = status === "generating";

  return (
    <div
      className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-2xl border bg-muted shadow-sm"
      aria-busy={isGenerating}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Prévia do banner gerado"
          className={`h-full w-full object-contain transition-opacity ${isGenerating ? "opacity-40" : ""}`}
        />
      ) : (
        !isGenerating && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" aria-hidden />
            <p className="text-sm">
              {status === "error" && errorMessage
                ? errorMessage
                : "Toque em Gerar banner para o sistema sortear os produtos e montar a imagem."}
            </p>
          </div>
        )
      )}

      {isGenerating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-medium">Montando o banner…</p>
        </div>
      )}
    </div>
  );
}
