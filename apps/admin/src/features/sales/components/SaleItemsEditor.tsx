import React from "react";
import { ImageIcon, Minus, Plus, X } from "lucide-react";
import { Button } from "@workspace/ui";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { formatCurrency, round2 } from "@workspace/core";
import { ProductSearchPicker } from "@/components/product-search-picker";
import type { ProductSearchOption } from "@/components/product-search-option";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import type { DraftItem } from "../hooks/useNewSaleDraft";

type SaleItemsEditorProps = {
  items: DraftItem[];
  onAdd: (option: ProductSearchOption) => void;
  onUpdate: (productId: number, patch: Partial<Pick<DraftItem, "quantity" | "unitPrice">>) => void;
  onRemove: (productId: number) => void;
};

/**
 * Os itens da Nova venda (06/10/2026).
 *
 * O produto vem da busca do servidor (a mesma da compra, por nome ou código), e
 * cada item vira um cartão: nome inteiro em cima, preço editável e quantidade
 * com − e + de 40px embaixo. Era uma tabela de quatro colunas dentro de uma caixa
 * `overflow-hidden`, que no celular cortava o X de remover — e o produto era um
 * select com o catálogo inteiro.
 */
export function SaleItemsEditor({ items, onAdd, onUpdate, onRemove }: SaleItemsEditorProps) {
  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">Produtos</span>
      <ProductSearchPicker
        onSelect={onAdd}
        // Marca na lista o que já está na venda; escolher de novo soma uma unidade.
        selectedIds={items.map((item) => item.productId)}
        placeholder="Buscar produto por nome ou código..."
      />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 py-6 text-center text-sm text-muted-foreground">
          Nenhum produto na venda.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const semSaldo = item.quantity > item.stock;
            return (
              <li key={item.productId} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex items-start gap-3">
                  {item.imageUrl ? (
                    <img
                      src={buildPublicImageUrl(item.imageUrl)}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md border border-border/50 bg-white object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted/40">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium leading-snug">{item.name}</p>
                    <p
                      className={
                        semSaldo ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"
                      }
                    >
                      {semSaldo ? `Só ${item.stock} em estoque` : `${item.stock} em estoque`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Tirar ${item.name} da venda`}
                    className="-mr-1 -mt-1 h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(item.productId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Uma unidade a menos de ${item.name}`}
                      className="h-10 w-10"
                      disabled={item.quantity <= 1}
                      onClick={() => onUpdate(item.productId, { quantity: item.quantity - 1 })}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                      {item.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Uma unidade a mais de ${item.name}`}
                      className="h-10 w-10"
                      onClick={() => onUpdate(item.productId, { quantity: item.quantity + 1 })}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">un.</span>
                    <CurrencyInput
                      value={item.unitPrice}
                      onChange={(unitPrice) => onUpdate(item.productId, { unitPrice })}
                      className="h-10 w-28 bg-background text-right"
                    />
                  </div>
                  <span className="w-full text-right text-sm font-semibold tabular-nums text-primary sm:w-auto">
                    {formatCurrency(round2(item.unitPrice * item.quantity))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
