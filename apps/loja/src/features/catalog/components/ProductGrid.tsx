import { Loader2 } from "lucide-react";
import { Skeleton } from "@workspace/ui";
import type { CatalogProduct } from "../types";
import { useInfiniteScrollSentinel } from "../hooks/useInfiniteScrollSentinel";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: CatalogProduct[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

/** Esqueletos com o formato do card, mostrados enquanto a próxima página chega. */
function CardSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Grade da vitrine com scroll infinito.
 *
 * O sentinela fica DEPOIS da grade e é observado com folga de 600px
 * (useInfiniteScrollSentinel): a próxima página começa a baixar antes de o
 * visitante alcançar o fim, então o scroll não tropeça num spinner. O botão
 * "Carregar mais" duplica o gesto para teclado e leitores de tela — sentinela
 * invisível não é acessível sozinho.
 */
export function ProductGrid({ products, hasNextPage, isFetchingNextPage, fetchNextPage }: ProductGridProps) {
  const sentinelRef = useInfiniteScrollSentinel({
    enabled: hasNextPage && !isFetchingNextPage,
    onLoadMore: fetchNextPage,
  });

  return (
    <div>
      {/* Uma coluna a menos que antes em cada faixa a partir de `sm`: a grade
          divide a largura com a lista de filtros desde `lg`, e manter cinco
          cards deixava a foto menor que a miniatura do card.

          No celular são DUAS colunas, não uma: com card de largura inteira o
          visitante via um produto por tela e desistia antes do terceiro rolar.
          O gap encolhe junto porque a 375px as 1,5rem de antes saíam da
          largura útil dos cards, não do respiro entre eles. */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.productGroupId} product={product} />
        ))}
        {isFetchingNextPage && <CardSkeletons count={4} />}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px" />

      <div className="mt-10 flex justify-center">
        {hasNextPage ? (
          <button
            type="button"
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-8 py-3 font-semibold text-foreground transition-colors duration-200 hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
          >
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFetchingNextPage ? "Carregando..." : "Carregar mais produtos"}
          </button>
        ) : (
          products.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Isso é tudo por enquanto — novidades chegam toda semana!
            </p>
          )
        )}
      </div>
    </div>
  );
}
