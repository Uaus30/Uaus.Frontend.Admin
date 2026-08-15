import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@workspace/ui";
import { totalDraftQuantity, type WriteOffDraftItem } from "@/lib/write-off-draft";

type WriteOffItemsListProps = {
  items: WriteOffDraftItem[];
  /** Itens cuja quantidade não cabe no saldo conhecido. */
  shortages: WriteOffDraftItem[];
  onChangeQuantity: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
};

/**
 * Lista de produtos da baixa em edição.
 *
 * O saldo aparece em cada linha, e a linha fica vermelha quando a quantidade
 * passa dele: o servidor recusaria a baixa inteira por causa de um item, e
 * offline essa recusa só chegaria na sincronização.
 */
export function WriteOffItemsList({ items, shortages, onChangeQuantity, onRemove }: WriteOffItemsListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Itens da baixa
        </Label>
        {items.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {totalDraftQuantity(items)} unidade(s)
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-8 text-center text-xs italic text-muted-foreground">
          Busque o produto acima para incluí-lo na baixa.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const short = item.quantity > item.availableStock;

            return (
              <div
                key={item.productId}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                  short ? "border-destructive/40 bg-destructive/5" : "border-border/40 bg-background/50"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight">{item.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {item.barcode} · Estoque: {item.availableStock}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-muted/30 p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 cursor-pointer"
                      onClick={() => onChangeQuantity(item.productId, item.quantity - 1)}
                    >
                      <Minus className="h-2 w-2" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      className="h-7 w-14 px-1 text-center font-mono text-xs font-bold"
                      value={item.quantity}
                      onChange={(event) => onChangeQuantity(item.productId, Number(event.target.value))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 cursor-pointer"
                      onClick={() => onChangeQuantity(item.productId, item.quantity + 1)}
                    >
                      <Plus className="h-2 w-2" />
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                    title="Tirar o produto da baixa"
                    onClick={() => onRemove(item.productId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shortages.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {shortages.map((item) => item.name).join(", ")} — a quantidade passa do estoque
            disponível. O servidor recusaria a baixa.
          </span>
        </div>
      )}
    </div>
  );
}
