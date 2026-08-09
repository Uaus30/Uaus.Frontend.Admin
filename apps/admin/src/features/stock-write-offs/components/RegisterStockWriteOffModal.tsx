import { AlertTriangle, Loader2, PackageMinus, X } from "lucide-react";
import { Button } from "@workspace/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import { formatQuantity } from "@/lib/formatters";
import { SELECTABLE_STOCK_WRITE_OFF_REASON_OPTIONS } from "@/services/stock-write-offs.service";
import { ProductSearchPicker } from "./ProductSearchPicker";
import type { ProductSearchOption, StockWriteOffDraftItem } from "../types";

type RegisterStockWriteOffModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  items: StockWriteOffDraftItem[];
  onAddItem: (product: ProductSearchOption) => void;
  onUpdateItemQuantity: (productId: number, quantity: number) => void;
  onRemoveItem: (productId: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  totalQuantity: number;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
};

/**
 * RegisterStockWriteOffModal
 *
 * Formulário de registro da baixa: motivo, itens e observação. A lista de
 * motivos vem de `SELECTABLE_STOCK_WRITE_OFF_REASON_OPTIONS`, que já exclui
 * Inventário — esse motivo só nasce da importação da contagem.
 */
export function RegisterStockWriteOffModal({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  items,
  onAddItem,
  onUpdateItemQuantity,
  onRemoveItem,
  notes,
  onNotesChange,
  totalQuantity,
  isSaving,
  onSubmit,
}: RegisterStockWriteOffModalProps) {
  const selectedIds = items.map((item) => item.productId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col border-border/50 bg-card sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PackageMinus className="h-5 w-5 text-primary" /> Registrar Baixa de Estoque
          </DialogTitle>
          <DialogDescription>
            Saída de mercadoria sem venda. O estoque é reduzido na hora e a baixa não entra no
            faturamento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto py-4 pr-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Motivo</Label>
              <Select value={reason} onValueChange={onReasonChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione o motivo da baixa..." />
                </SelectTrigger>
                <SelectContent>
                  {SELECTABLE_STOCK_WRITE_OFF_REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 rounded-xl border border-border/50 bg-background/50 p-4">
              <h4 className="text-sm font-semibold">Itens da baixa</h4>
              <ProductSearchPicker
                onSelect={onAddItem}
                selectedIds={selectedIds}
                disabled={isSaving}
              />

              {items.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-lg border border-border/50 bg-card">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border/50 bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2">Cód. Barras</th>
                        <th className="px-3 py-2 text-right">Estoque</th>
                        <th className="w-28 px-3 py-2">Qtd</th>
                        <th className="w-10 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.productId} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {item.barcode || "-"}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {formatQuantity(item.stock)}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(event) =>
                                onUpdateItemQuantity(item.productId, Number(event.target.value))
                              }
                              className="h-8 bg-background"
                              aria-label={`Quantidade de ${item.productName}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.productId)}
                              className="text-destructive hover:opacity-70"
                              aria-label={`Remover ${item.productName}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* O saldo mostrado é o do momento da escolha; quem decide se cabe
                  é o backend, que planeja o consumo lote a lote. */}
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Baixa acima do saldo é recusada. Para acertar diferença de contagem, use o
                inventário.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Observação (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="O que aconteceu com a mercadoria..."
                className="bg-background"
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-border/50 px-2 pt-4">
            <div className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "produto" : "produtos"} ·{" "}
              {formatQuantity(totalQuantity)} de quantidade total
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="hover-elevate">
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PackageMinus className="mr-2 h-4 w-4" />
                )}
                Registrar Baixa
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


