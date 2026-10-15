import { Button } from "@workspace/ui";
import { Download, Share2 } from "lucide-react";
import type { PieceProgress } from "../lib/buildPiece";
import type { CatalogFormatOption } from "../lib/formats";
import type { GeneratedPiece, GeneratorStatus } from "../hooks/usePieceSession";
import { CatalogPreview } from "./CatalogPreview";

interface PieceOutputProps {
  status: GeneratorStatus;
  /** O formato da moldura sem peça na tela — com peça, vale o dela. */
  format: CatalogFormatOption;
  piece: GeneratedPiece | null;
  progress: PieceProgress | null;
  busyNoun: string | null;
  errorMessage: string | null;
  /** O aparelho abre a folha de compartilhamento com arquivo (celular)? */
  canShare: boolean;
  isGenerating: boolean;
  onShare: () => void;
  onDownload: () => void;
  /** O convite da moldura vazia. */
  emptyHint?: string;
}

/**
 * A prévia e os botões de compartilhar e baixar — iguais nas duas abas.
 *
 * Compartilhar só aparece onde a folha do aparelho aceita arquivo (celular); no
 * computador fica o Baixar.
 */
export function PieceOutput({
  status,
  format,
  piece,
  progress,
  busyNoun,
  errorMessage,
  canShare,
  isGenerating,
  onShare,
  onDownload,
  emptyHint,
}: PieceOutputProps) {
  return (
    <>
      <CatalogPreview
        status={status}
        format={piece?.format ?? format}
        previewUrls={piece?.previewUrls ?? []}
        progress={progress}
        busyNoun={busyNoun}
        errorMessage={errorMessage}
        emptyHint={emptyHint}
      />

      {piece && (
        <div className="mx-auto flex w-full max-w-[360px] flex-col gap-2 sm:flex-row">
          {canShare && (
            <Button onClick={onShare} disabled={isGenerating} className="flex-1 gap-2">
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
          )}
          <Button variant="outline" onClick={onDownload} disabled={isGenerating} className="flex-1 gap-2">
            <Download className="h-4 w-4" /> Baixar
          </Button>
        </div>
      )}
    </>
  );
}
