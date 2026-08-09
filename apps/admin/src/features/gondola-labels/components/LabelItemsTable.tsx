import { Eraser, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { LABEL_TYPE_INFOS, type LabelDraftItem, type LabelTypeCode } from "../types";

interface LabelItemsTableProps {
  items: LabelDraftItem[];
  description: string;
  setDescription: (value: string) => void;
  totalLabels: number;
  totalProducts: number;
  printing: boolean;
  canGenerate: boolean;
  onUpdate: (index: number, patch: Partial<LabelDraftItem>) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onGenerate: () => void;
}

/** Bolinha com a cor de fundo do tipo, usada nas opções do select. */
function TypeDot({ background }: { background: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
      style={{ background }}
    />
  );
}

/** Lista editável das etiquetas do lote: tipo, preço e cópias por produto. */
export function LabelItemsTable({
  items,
  description,
  setDescription,
  totalLabels,
  totalProducts,
  printing,
  canGenerate,
  onUpdate,
  onRemove,
  onClear,
  onGenerate,
}: LabelItemsTableProps) {
  return (
    <Card className="border-border/50 shadow-lg shadow-black/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Etiquetas do Lote</CardTitle>
        <CardDescription>
          Defina o tipo, o preço impresso e as cópias de cada etiqueta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          placeholder="Identificação do lote (opcional) — ex.: Promoção da semana"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={150}
          className="bg-background"
        />

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
            Busque e adicione produtos para montar o lote de etiquetas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Produto</th>
                  <th className="px-3 py-2 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Preço (R$)</th>
                  <th className="px-3 py-2 text-center font-medium">Cópias</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item, index) => (
                  <tr key={`${item.productId}-${item.labelType}`}>
                    <td className="max-w-56 px-3 py-2">
                      <p className="truncate font-medium text-foreground">{item.productName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.barcode ?? "Sem código de barras"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={String(item.labelType)}
                        onValueChange={(value) =>
                          onUpdate(index, { labelType: Number(value) as LabelTypeCode })
                        }
                      >
                        <SelectTrigger className="h-8 w-44 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LABEL_TYPE_INFOS.map((info) => (
                            <SelectItem key={info.code} value={String(info.code)}>
                              <span className="flex items-center gap-2">
                                <TypeDot background={info.background} />
                                {info.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={item.priceInput}
                        inputMode="decimal"
                        onChange={(event) => onUpdate(index, { priceInput: event.target.value })}
                        className="h-8 w-24 bg-background text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={item.quantityInput}
                        inputMode="numeric"
                        onChange={(event) => onUpdate(index, { quantityInput: event.target.value })}
                        className="mx-auto h-8 w-16 bg-background text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Remover do lote"
                        onClick={() => onRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {totalProducts} produto(s) · {totalLabels} etiqueta(s)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={items.length === 0 || printing}
              onClick={onClear}
            >
              <Eraser className="mr-2 h-4 w-4" /> Limpar
            </Button>
            <Button
              type="button"
              className="hover-elevate"
              disabled={!canGenerate}
              onClick={onGenerate}
            >
              {printing ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              Salvar e Imprimir
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
