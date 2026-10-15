import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { formatCapacity, type CatalogFormatOption } from "../lib/formats";
import { TITLE_MAX_LENGTH } from "../template/text";
import type { CatalogFormat } from "../types";

interface CustomCatalogControlsProps {
  formats: CatalogFormatOption[];
  format: CatalogFormatOption;
  onFormatChange: (key: CatalogFormat) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

/**
 * Formato e título da aba Personalizado. O botão de gerar fica no pé da lista
 * dos escolhidos, onde a pessoa termina de montar.
 *
 * Só os banners: o PDF continua no automático (decisão do dono, 15/10/2026). O
 * título é obrigatório — sem tema não há título para sugerir.
 */
export function CustomCatalogControls({
  formats,
  format,
  onFormatChange,
  title,
  onTitleChange,
}: CustomCatalogControlsProps) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="space-y-1.5">
        <Label htmlFor="custom-catalog-format">Formato</Label>
        <Select value={format.key} onValueChange={(key) => onFormatChange(key as CatalogFormat)}>
          <SelectTrigger id="custom-catalog-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {formats.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label} · até {formatCapacity(option)} produtos
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Para {format.hint}. O catálogo em PDF continua só no Automático.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="custom-catalog-title">Título</Label>
        <Input
          id="custom-catalog-title"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Ex.: Dia das Crianças"
        />
        <p className="text-xs text-muted-foreground">
          Vai no cabeçalho, junto do logotipo. Até {TITLE_MAX_LENGTH} caracteres.
        </p>
      </div>
    </div>
  );
}
