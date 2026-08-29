import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@workspace/ui";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { FEATURED_COUNT, useFeaturedProducts } from "@/features/catalog/hooks/useFeaturedProducts";

/** Esqueletos no formato do card, enquanto a primeira página chega. */
function FeaturedSkeletons() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-2xl border border-border bg-white">
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
 * Faixa de produtos reais na home, reusando o `ProductCard` da vitrine — mesmo
 * card, mesmo preço, mesmo link de detalhe. Regra do §4 do CLAUDE.md: a query
 * mora em `useFeaturedProducts`; aqui só entra o que renderiza.
 *
 * A seção some inteira quando não há produtos (ver o hook). Com poucos, a
 * grade simplesmente mostra os que existem em vez de fingir oito.
 */
export function FeaturedProducts() {
  const featured = useFeaturedProducts();

  if (featured.isEmpty) return null;

  return (
    <section className="border-t border-border bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-black text-foreground md:text-4xl">Novidades na loja</h2>
            <p className="mt-3 text-muted-foreground">
              Uma amostra do que está nas prateleiras agora — e nenhum passa de R$ 30,00.
            </p>
          </div>

          <Link
            href="/produtos"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {featured.totalCount > FEATURED_COUNT
              ? `Ver todos os ${featured.totalCount} produtos`
              : "Ver todos os produtos"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.isLoading ? (
            <FeaturedSkeletons />
          ) : (
            featured.products.map((product) => <ProductCard key={product.productGroupId} product={product} />)
          )}
        </div>
      </div>
    </section>
  );
}
