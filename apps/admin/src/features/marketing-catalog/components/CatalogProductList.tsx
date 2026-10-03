import { Button } from "@workspace/ui";
import { Shuffle } from "lucide-react";
import { ROLE_LABEL } from "../lib/catalogProducts";
import type { CatalogProduct } from "../types";

interface CatalogProductListProps {
  products: CatalogProduct[];
  isGenerating: boolean;
  /** Troca este produto por outro do mesmo papel, mantendo os demais. */
  onSwap: (productGroupId: number) => void;
}

/**
 * Quem saiu no banner, na ordem em que foi desenhado, com a troca de um por um.
 *
 * O papel aparece ao lado do nome porque é ele que explica a troca: "Trocar"
 * numa novidade traz outra novidade, e não um produto qualquer.
 */
export function CatalogProductList({ products, isGenerating, onSwap }: CatalogProductListProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Produtos neste banner ({products.length})
      </p>

      <ul className="mt-2 divide-y">
        {products.map((product) => (
          <li key={product.productGroupId} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[product.role]}</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={isGenerating}
              onClick={() => onSwap(product.productGroupId)}
              aria-label={`Trocar ${product.name} por outro produto`}
            >
              <Shuffle className="h-3.5 w-3.5" /> Trocar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
