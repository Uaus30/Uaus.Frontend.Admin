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
import { describeProductCount, type CatalogThemeOption } from "../lib/themes";
import { TITLE_MAX_LENGTH } from "../template/text";

interface CatalogControlsProps {
  themes: CatalogThemeOption[];
  /** O tema selecionado. Ausente enquanto a lista não chegou. */
  theme?: CatalogThemeOption;
  onThemeChange: (key: string) => void;
  isLoadingThemes: boolean;
  themesFailed: boolean;
  title: string;
  onTitleChange: (title: string) => void;
  /** Já existe um banner na tela: o botão principal vira "Sortear de novo". */
  hasBanner: boolean;
  isGenerating: boolean;
  /** O título do campo difere do impresso na peça. */
  titleChanged: boolean;
  onGenerate: () => void;
  onApplyTitle: () => void;
}

/**
 * O que se escolhe ANTES de gerar: o tema e o título.
 *
 * Fica acima da prévia de propósito (pedido do dono, 03/10/2026): no celular a
 * tela é uma coluna só, e com a prévia em cima o botão de gerar ficava abaixo
 * de uma moldura vazia de 600 px.
 */
export function CatalogControls({
  themes,
  theme,
  onThemeChange,
  isLoadingThemes,
  themesFailed,
  title,
  onTitleChange,
  hasBanner,
  isGenerating,
  titleChanged,
  onGenerate,
  onApplyTitle,
}: CatalogControlsProps) {
  const canGenerate = theme !== undefined && theme.products > 0 && !isGenerating;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="catalog-theme">Tema</Label>
        <Select value={theme?.key ?? ""} onValueChange={onThemeChange} disabled={themes.length === 0}>
          <SelectTrigger id="catalog-theme">
            <SelectValue placeholder={isLoadingThemes ? "Carregando os temas…" : "Escolha o tema"} />
          </SelectTrigger>
          <SelectContent>
            {themes.map((option) => (
              // Tema sem produto continua na lista, desabilitado: sumir com
              // "Novidades" num mês sem novidade pareceria defeito da tela.
              <SelectItem key={option.key} value={option.key} disabled={option.products === 0}>
                {option.label} · {describeProductCount(option.products)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {themesFailed && (
          <p className="text-sm text-destructive">Não foi possível carregar os temas. Recarregue a página.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="catalog-title">Título do banner</Label>
        <Input
          id="catalog-title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder={theme?.title}
          disabled={theme === undefined}
        />
        <p className="text-xs text-muted-foreground">
          Vai no cabeçalho, abaixo do logotipo. Até {TITLE_MAX_LENGTH} caracteres.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={onGenerate} disabled={!canGenerate} className="gap-2">
          {hasBanner ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {hasBanner ? "Sortear de novo" : "Gerar banner"}
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
