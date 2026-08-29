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
        <div key={index} className="overflow-hidden rounded-2xl bg-white shadow-md">
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
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
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
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-white px-8 py-3 font-bold text-foreground transition-all duration-300 hover:border-primary/50 hover:bg-orange-50 disabled:opacity-60"
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
