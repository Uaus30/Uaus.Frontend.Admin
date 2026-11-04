import { AlertTriangle, Sparkles } from "lucide-react";
import {
  Button,
  cn,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { PRINTED_NAME_MAX_LENGTH } from "../lib/customSelection";
import type { CatalogFormatOption } from "../lib/formats";
import { SPOTLIGHT_KIND_ORDER, SPOTLIGHT_KINDS, type SpotlightKindState } from "../lib/spotlight";
import { TITLE_MAX_LENGTH } from "../template/text";
import type { SpotlightFormat, SpotlightKind } from "../types";

interface SpotlightControlsProps {
  /** O produto escolhido, no alto do quadro (a aba Destaque; a janela já o diz no título). */
  productLabel?: string;
  kinds: Record<SpotlightKind, SpotlightKindState>;
  kind: SpotlightKind;
  onKindChange: (kind: SpotlightKind) => void;
  formats: CatalogFormatOption[];
  format: CatalogFormatOption;
  onFormatChange: (format: SpotlightFormat) => void;
  title: string;
  titlePlaceholder: string;
  onTitleChange: (title: string) => void;
  printedName: string;
  /** O nome do cadastro — o que sai com o campo vazio. */
  namePlaceholder: string;
  onPrintedNameChange: (name: string) => void;
  /** Avisos que não travam (novidade fora da janela, foto pequena). */
  hints: string[];
  /** Sem produto escolhido, ou gerando. */
  disabled: boolean;
  hasPiece: boolean;
  onGenerate: () => void;
}

/**
 * Tipo, tamanho, título e nome do banner de destaque (04/11/2026), com o botão
 * de gerar. O mesmo na janela da listagem de produtos e na aba Destaque.
 *
 * Só o tipo Promocional trava, e só sem promoção ativa; a marca "sugerido" segue
 * o que o servidor sabe do produto (promoção, até 30 dias na loja, compra da
 * semana).
 */
export function SpotlightControls({
  productLabel,
  kinds,
  kind,
  onKindChange,
  formats,
  format,
  onFormatChange,
  title,
  titlePlaceholder,
  onTitleChange,
  printedName,
  namePlaceholder,
  onPrintedNameChange,
  hints,
  disabled,
  hasPiece,
  onGenerate,
}: SpotlightControlsProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      {productLabel !== undefined && (
        <div>
          <p className="text-xs text-muted-foreground">Produto</p>
          <p className="truncate text-sm font-medium text-foreground">
            {productLabel || "Busque e escolha o produto acima."}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label id="spotlight-kind-label">Tipo</Label>
        <div role="radiogroup" aria-labelledby="spotlight-kind-label" className="grid grid-cols-3 gap-2">
          {SPOTLIGHT_KIND_ORDER.map((key) => {
            const state = kinds[key];
            const selected = key === kind;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!state.enabled}
                onClick={() => onKindChange(key)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center text-sm font-medium transition-colors",
                  "hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                  selected && "border-primary bg-primary/10 text-primary hover:bg-primary/15",
                )}
              >
                {SPOTLIGHT_KINDS[key].label}
                {state.suggested ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-emerald-700 dark:text-emerald-300">
                    <Sparkles className="h-3 w-3" aria-hidden /> sugerido
                  </span>
                ) : (
                  state.reason && (
                    <span className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                      {state.reason}
                    </span>
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spotlight-format">Tamanho</Label>
        <Select value={format.key} onValueChange={(key) => onFormatChange(key as SpotlightFormat)}>
          <SelectTrigger id="spotlight-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {formats.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Para {format.hint}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spotlight-title">Título</Label>
        <Input
          id="spotlight-title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          placeholder={titlePlaceholder}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Vai no cabeçalho, junto do logotipo. Trocar o tipo volta ao título sugerido.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="spotlight-name">Nome no banner</Label>
        <Input
          id="spotlight-name"
          value={printedName}
          maxLength={PRINTED_NAME_MAX_LENGTH}
          placeholder={namePlaceholder}
          onChange={(event) => onPrintedNameChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Só no banner: o cadastro não muda. Vazio, sai o nome do cadastro.
        </p>
      </div>

      {hints.map((hint) => (
        <p
          key={hint}
          className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {hint}
        </p>
      ))}

      <Button className="w-full" onClick={onGenerate} disabled={disabled}>
        {hasPiece ? "Gerar de novo" : "Gerar banner"}
      </Button>
    </div>
  );
}
