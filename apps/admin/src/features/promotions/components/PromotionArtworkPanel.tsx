import { useRef, useState } from "react";
import { Button, Label } from "@workspace/ui";
import { AlertTriangle, Sparkles, Trash2, Upload } from "lucide-react";
import { ART_FORMAT } from "../hooks/promotionPrompt";
import type { PromotionArtFormat } from "../hooks/promotionPrompt";
import { PromotionPromptDialog } from "./PromotionPromptDialog";
import type { PromotionArtwork } from "../types";
import type { PromotionPromptInput } from "../hooks/promotionPrompt";

/**
 * Os dois slots de arte da relâmpago, com o botão de prompt ao lado de cada um.
 *
 * ## Por que duas, e por que estas proporções
 *
 * 4:5 é o feed e, principalmente, o **grupo de WhatsApp** — o canal onde a loja
 * divulga toda semana e onde a cliente da relâmpago está às 15h de sábado. 9:16
 * é o Stories. É por isso que a fase das artes veio antes da vitrine: o retorno
 * do site para uma promoção de quatro horas nunca foi medido.
 *
 * ## Aviso, não recusa
 *
 * A proporção fora do esperado gera aviso e nada mais (§7.4). A loja pode ter
 * uma arte 1:1 pronta e querer usá-la; travar o upload por dez pixels seria o
 * sistema decidindo direção de arte.
 */

function Slot({
  format,
  artwork,
  onPick,
  onClear,
  onPrompt,
  promptDisabled,
}: {
  format: PromotionArtFormat;
  artwork: PromotionArtwork | null;
  onPick: (file: File) => void;
  onClear: () => void;
  onPrompt: () => void;
  /** Sem produto ou sem desconto não há prompt a montar — o botão diz isso. */
  promptDisabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const formato = ART_FORMAT[format];

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-semibold">
          {formato.ratio} <span className="font-normal text-muted-foreground">· {formato.label}</span>
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={onPrompt}
          disabled={promptDisabled}
          title={promptDisabled ? "Escolha o produto e o desconto para montar o prompt" : undefined}
        >
          <Sparkles className="h-3.5 w-3.5" /> Prompt
        </Button>
      </div>

      <div
        className="relative flex items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/20"
        style={{ aspectRatio: formato.ratio.replace(":", " / ") }}
      >
        {artwork ? (
          <img src={artwork.url} alt={`Arte ${formato.ratio}`} className="h-full w-full object-contain" />
        ) : (
          <span className="px-3 text-center text-xs text-muted-foreground">
            Sem arte. Gere pelo prompt e envie o arquivo aqui.
          </span>
        )}
      </div>

      {artwork?.aspectWarning && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{artwork.aspectWarning}</span>
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => input.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> {artwork ? "Trocar" : "Enviar arte"}
        </Button>

        {artwork && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={onClear}
            title="Tirar a arte"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          // Zerar o valor deixa a MESMA foto ser escolhida de novo depois de uma
          // troca desfeita — sem isso o `change` não dispara na segunda vez.
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function PromotionArtworkPanel({
  feedImage,
  storyImage,
  onPick,
  onClear,
  promptInput,
  coverImageUrl,
}: {
  feedImage: PromotionArtwork | null;
  storyImage: PromotionArtwork | null;
  onPick: (format: PromotionArtFormat, file: File) => void;
  onClear: (format: PromotionArtFormat) => void;
  /** O que o prompt precisa, menos formato e assinatura. Nulo esconde o botão de prompt. */
  promptInput: Omit<PromotionPromptInput, "format" | "signature"> | null;
  coverImageUrl?: string | null;
}) {
  const [promptFormat, setPromptFormat] = useState<PromotionArtFormat | null>(null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Artes da promoção</p>
        <p className="text-xs text-muted-foreground">
          Opcionais. A arte é gerada fora, com o prompt que esta tela monta, e volta aqui por upload.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Slot
          format="feed"
          artwork={feedImage}
          onPick={(file) => onPick("feed", file)}
          onClear={() => onClear("feed")}
          onPrompt={() => setPromptFormat("feed")}
          promptDisabled={!promptInput}
        />
        <Slot
          format="story"
          artwork={storyImage}
          onPick={(file) => onPick("story", file)}
          onClear={() => onClear("story")}
          onPrompt={() => setPromptFormat("story")}
          promptDisabled={!promptInput}
        />
      </div>

      {promptInput && promptFormat && (
        <PromotionPromptDialog
          open
          onOpenChange={(aberto) => !aberto && setPromptFormat(null)}
          format={promptFormat}
          input={promptInput}
          coverImageUrl={coverImageUrl}
        />
      )}
    </div>
  );
}
