import { ImageIcon, Loader2 } from "lucide-react";
import type { PieceProgress } from "../lib/buildPiece";
import type { CatalogFormatOption } from "../lib/formats";
import type { GeneratorStatus } from "../hooks/useCatalogGenerator";
import type { CatalogFormat } from "../types";

interface CatalogPreviewProps {
  status: GeneratorStatus;
  /** O formato da peça que está na moldura — ou, sem peça, o que está selecionado. */
  format: CatalogFormatOption;
  /** Uma URL por página da peça pronta. Vazio antes da primeira geração. */
  previewUrls: string[];
  /** Em que página o desenho está, quando são várias. */
  progress: PieceProgress | null;
  /**
   * O que está sendo desenhado ("banner" ou "catálogo"). Vem separado do
   * formato porque a moldura ainda mostra a peça ANTERIOR enquanto a nova é
   * montada: gerar o PDF por cima de um banner dizia "Montando o banner…".
   */
  busyNoun: string | null;
  errorMessage?: string | null;
}

/** A proporção da moldura. A do PDF é a de um celular em pé, com as páginas rolando dentro. */
const FRAME: Record<CatalogFormat, string> = {
  story: "aspect-[9/16]",
  feed: "aspect-[4/5]",
  pdf: "aspect-[9/16]",
};

/**
 * A moldura da prévia.
 *
 * O que aparece aqui É o que será compartilhado, e não uma simulação em HTML:
 * no banner, o próprio arquivo; no catálogo, as mesmas imagens que estão dentro
 * do PDF. Durante uma nova geração a peça anterior continua visível, esmaecida
 * — trocar por um espaço vazio faria a tela pular a cada "Sortear de novo".
 */
export function CatalogPreview({
  status,
  format,
  previewUrls,
  progress,
  busyNoun,
  errorMessage,
}: CatalogPreviewProps) {
  const isGenerating = status === "generating";
  const isPdf = format.key === "pdf";
  const pages = previewUrls.length;

  return (
    <div className="mx-auto w-full max-w-[360px] space-y-2">
      <div
        className={`relative ${FRAME[format.key]} w-full overflow-hidden rounded-2xl border bg-muted shadow-sm`}
        aria-busy={isGenerating}
      >
        {pages > 0 ? (
          <div
            className={`h-full w-full transition-opacity ${isPdf ? "overflow-y-auto" : ""} ${isGenerating ? "opacity-40" : ""}`}
          >
            {previewUrls.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={isPdf ? `Página ${index + 1} de ${pages} do catálogo gerado` : "Prévia do banner gerado"}
                className={isPdf ? "block w-full border-b last:border-b-0" : "h-full w-full object-contain"}
              />
            ))}
          </div>
        ) : (
          !isGenerating && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10" aria-hidden />
              <p className="text-sm">
                {status === "error" && errorMessage
                  ? errorMessage
                  : `Toque em Gerar ${format.noun} para o sistema sortear os produtos e montar ${isPdf ? "o PDF" : "a imagem"}.`}
              </p>
            </div>
          )
        )}

        {isGenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium" role="status">
              {progress && progress.pages > 1
                ? `Montando a página ${progress.page} de ${progress.pages}…`
                : `Montando o ${busyNoun ?? format.noun}…`}
            </p>
          </div>
        )}
      </div>

      {isPdf && pages > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {pages === 1 ? "1 página" : `${pages} páginas — role para ver todas`}. No PDF, tocar num produto
          abre a página dele no site.
        </p>
      )}
    </div>
  );
}
