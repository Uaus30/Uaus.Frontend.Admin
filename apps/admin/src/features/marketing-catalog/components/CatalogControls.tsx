import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { PencilLine, RefreshCw, Sparkles } from "lucide-react";
import { availableProducts, describeFormatSize, type CatalogFormatOption } from "../lib/formats";
import { describeProductCount, type CatalogThemeOption } from "../lib/themes";
import { TITLE_MAX_LENGTH } from "../template/text";
import type { CatalogFormat } from "../types";

interface CatalogControlsProps {
  formats: CatalogFormatOption[];
  format: CatalogFormatOption;
  onFormatChange: (key: CatalogFormat) => void;
  themes: CatalogThemeOption[];
  /** O tema selecionado. Ausente enquanto a lista não chegou. */
  theme?: CatalogThemeOption;
  onThemeChange: (key: string) => void;
  isLoadingThemes: boolean;
  themesFailed: boolean;
  title: string;
  onTitleChange: (title: string) => void;
  /** Já existe na tela uma peça deste formato: o botão principal vira "Sortear de novo". */
  hasPiece: boolean;
  isGenerating: boolean;
  /** O título do campo difere do impresso na peça. */
  titleChanged: boolean;
  onGenerate: () => void;
  onApplyTitle: () => void;
}

/**
 * O que se escolhe ANTES de gerar: o formato, o tema e o título.
 *
 * Fica acima da prévia de propósito (pedido do dono, 03/10/2026): no celular a
 * tela é uma coluna só, e com a prévia em cima o botão de gerar ficava abaixo
 * de uma moldura vazia de 600 px.
 */
export function CatalogControls({
  formats,
  format,
  onFormatChange,
  themes,
  theme,
  onThemeChange,
  isLoadingThemes,
  themesFailed,
  title,
  onTitleChange,
  hasPiece,
  isGenerating,
  titleChanged,
  onGenerate,
  onApplyTitle,
}: CatalogControlsProps) {
  const canGenerate = theme !== undefined && availableProducts(theme, format) > 0 && !isGenerating;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="catalog-format">Formato</Label>
        <Select value={format.key} onValueChange={(key) => onFormatChange(key as CatalogFormat)}>
          <SelectTrigger id="catalog-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {formats.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label} · {describeFormatSize(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Para {format.hint}.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catalog-theme">Tema</Label>
        <Select value={theme?.key ?? ""} onValueChange={onThemeChange} disabled={themes.length === 0}>
          <SelectTrigger id="catalog-theme">
            <SelectValue placeholder={isLoadingThemes ? "Carregando os temas…" : "Escolha o tema"} />
          </SelectTrigger>
          <SelectContent>
            {themes.map((option) => {
              // A contagem é a do formato: o catálogo em PDF só usa foto grande.
              const products = availableProducts(option, format);
              return (
                // Tema sem produto continua na lista, desabilitado: sumir com
                // "Novidades" num mês sem novidade pareceria defeito da tela.
                <SelectItem key={option.key} value={option.key} disabled={products === 0}>
                  {option.label} · {describeProductCount(products)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {themesFailed && (
          <p className="text-sm text-destructive">Não foi possível carregar os temas. Recarregue a página.</p>
        )}
        {format.minPhotoSide > 0 && (
          <p className="text-xs text-muted-foreground">
            O catálogo em PDF só sorteia produto com foto de {format.minPhotoSide} px ou mais: foto menor
            borra no card grande. As pequenas estão em BI › Anomalias, etiqueta “Foto pequena”.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catalog-title">Título</Label>
        <Input
          id="catalog-title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={theme?.title}
          disabled={theme === undefined}
        />
        <p className="text-xs text-muted-foreground">
          Vai no cabeçalho, junto do logotipo. Até {TITLE_MAX_LENGTH} caracteres.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={onGenerate} disabled={!canGenerate} className="gap-2">
          {hasPiece ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {hasPiece ? "Sortear de novo" : `Gerar ${format.noun}`}
        </Button>

        {titleChanged && (
          <Button variant="outline" onClick={onApplyTitle} disabled={isGenerating} className="gap-2">
            <PencilLine className="h-4 w-4" /> Atualizar título
          </Button>
        )}
      </div>
    </div>
  );
}
