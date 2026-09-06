import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@workspace/ui";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { useFeaturedProducts } from "@/features/catalog/hooks/useFeaturedProducts";

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
 * Seção "Novidades" da home: os últimos produtos cadastrados, reusando o
 * `ProductCard` da vitrine — mesmo card, mesmo preço, mesmo link de detalhe.
 * Regra do §4 do CLAUDE.md: a query mora em `useFeaturedProducts`; aqui só
 * entra o que renderiza.
 *
 * Quantos produtos aparecem é configurável em Admin > Configurações (padrão
 * 20). A seção some inteira quando não há produtos (ver o hook). Com poucos, a
 * grade simplesmente mostra os que existem em vez de fingir a quantidade.
 *
 * O link do topo NÃO diz o tamanho do catálogo — era "Ver todos os 347
 * produtos". Ver o README do `catalog`: o site não publica a quantidade total.
 */
export function FeaturedProducts() {
  const featured = useFeaturedProducts();

  if (featured.isEmpty) return null;

  return (
    <section className="border-t border-border bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-3xl font-black text-foreground md:text-4xl">Novidades</h2>
            <p className="mt-3 text-muted-foreground">
              Os últimos produtos que chegaram à loja — e nenhum passa de R$ 30,00.
            </p>
          </div>

          <Link
            href="/produtos"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-white px-5 py-3 font-semibold text-foreground transition-colors duration-200 hover:border-primary/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Ver todos os produtos
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Duas colunas já no celular, como na vitrine: card de largura
            inteira mostrava um produto por tela e os oito destaques viravam
            oito rolagens. O gap menor no celular devolve largura ao card. */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
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
