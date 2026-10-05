import { Button, Checkbox, cn } from "@workspace/ui";
import { Shuffle } from "lucide-react";
import { ROLE_LABEL } from "../lib/catalogProducts";
import type { CatalogProduct } from "../types";

interface CatalogProductListProps {
  products: CatalogProduct[];
  /** "banner" ou "catálogo": o nome da peça no título da lista. */
  noun: string;
  /** Produtos por página. Quando a peça tem mais de uma, a linha diz em qual o produto saiu. */
  pageSize: number;
  isGenerating: boolean;
  /** Os produtos marcados para a próxima troca. */
  selectedIds: readonly number[];
  onToggle: (productGroupId: number) => void;
  onClearSelection: () => void;
  /** Troca os marcados, cada um por outro do mesmo papel, num redesenho só. */
  onSwapSelected: () => void;
}

/**
 * Quem saiu na peça, na ordem em que foi desenhado, com a troca dos marcados.
 *
 * A troca é em lote: marcar três e tocar uma vez redesenha a peça uma vez só —
 * um por um eram três desenhos (e, no PDF, três montagens do arquivo).
 *
 * O papel aparece ao lado do nome porque é ele que explica a troca: a novidade
 * trocada dá lugar a outra novidade, e não a um produto qualquer.
 */
export function CatalogProductList({
  products,
  noun,
  pageSize,
  isGenerating,
  selectedIds,
  onToggle,
  onClearSelection,
  onSwapSelected,
}: CatalogProductListProps) {
  const hasPages = products.length > pageSize;
  const selected = new Set(selectedIds);
  const count = products.filter((product) => selected.has(product.productGroupId)).length;

  return (
    <div className="rounded-xl border bg-card p-4 pb-0 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Produtos neste {noun} ({products.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Marque os que quer trocar: cada um dá lugar a outro do mesmo tipo, e os demais ficam onde estão.
      </p>

      <ul className="mt-2 divide-y">
        {products.map((product, index) => {
          const isSelected = selected.has(product.productGroupId);
          return (
            <li key={product.productGroupId}>
              <label
                className={cn(
                  "-mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 transition-colors",
                  isSelected && "bg-primary/10",
                  isGenerating && "cursor-not-allowed opacity-60",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  disabled={isGenerating}
                  onCheckedChange={() => onToggle(product.productGroupId)}
                  aria-label={`Marcar ${product.name} para trocar`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{product.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {hasPages && `Página ${Math.floor(index / pageSize) + 1} · `}
                    {ROLE_LABEL[product.role]}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {/* Presa ao pé da tela enquanto a lista rola: no PDF são 30 linhas, e o
          botão não pode ficar lá em cima, longe de quem marcou o último. */}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 rounded-b-xl border-t bg-card px-4 py-3">
        <Button
          size="sm"
          className="flex-1 gap-1.5 sm:flex-none"
          disabled={isGenerating || count === 0}
          onClick={onSwapSelected}
        >
          <Shuffle className="h-3.5 w-3.5" />
          {count === 0 ? "Trocar selecionados" : `Trocar ${count} ${count === 1 ? "produto" : "produtos"}`}
        </Button>
        {count > 0 && (
          <Button variant="ghost" size="sm" disabled={isGenerating} onClick={onClearSelection}>
            Desmarcar
          </Button>
        )}
      </div>
    </div>
  );
}
