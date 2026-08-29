import { Loader2, PackageOpen, RefreshCcw, SearchX } from "lucide-react";
import { usePageTitle } from "@/lib/page-title";
import { useCatalog } from "@/features/catalog/hooks/useCatalog";
import { CatalogSearch } from "@/features/catalog/components/CatalogSearch";
import { ProductGrid } from "@/features/catalog/components/ProductGrid";

function StateMessage({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof PackageOpen;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <Icon className="h-12 w-12 text-orange-300" aria-hidden />
      <p className="text-xl font-bold text-foreground">{title}</p>
      <p className="max-w-md text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

/**
 * Vitrine de produtos. A página só renderiza o que `useCatalog` devolve —
 * query, busca e paginação moram no hook (regra do CLAUDE.md §4).
 */
export default function ProductsPage() {
  usePageTitle("Uaus | Produtos");
  const catalog = useCatalog();

  return (
    <div className="min-h-screen bg-orange-50/30 pb-24">
      <section className="mb-16 bg-primary pb-16 pt-20 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-black text-white md:text-6xl">
            Promoções e <span className="text-white/90">Novidades</span>
          </h1>
          <p className="mt-4 text-lg text-white/90">Todas as imagens são meramente ilustrativas.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <CatalogSearch
          value={catalog.search}
          onChange={catalog.setSearch}
          isSearching={catalog.isSearching}
        />

        {catalog.totalCount > 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {catalog.totalCount === 1 ? "1 produto" : `${catalog.totalCount} produtos`}
            {catalog.search.trim() ? " encontrados" : " na loja"}
          </p>
        )}

        <div className="mt-12">
          {catalog.isLoading ? (
            <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
              Carregando produtos...
            </div>
          ) : catalog.isError ? (
            <StateMessage
              icon={PackageOpen}
              title="Ops! Ocorreu um erro ao carregar os produtos."
              subtitle={catalog.errorMessage || "Tente recarregar a página ou voltar mais tarde."}
            >
              <button
                type="button"
                onClick={catalog.refetch}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-orange-400 px-6 py-3 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl"
              >
                <RefreshCcw className="h-4 w-4" />
                Tentar de novo
              </button>
            </StateMessage>
          ) : catalog.isSearchEmpty ? (
            <StateMessage
              icon={SearchX}
              title="Nenhum produto encontrado"
              subtitle="Tente buscar com outro nome, termo ou descrição."
            />
          ) : catalog.isEmpty ? (
            <StateMessage
              icon={PackageOpen}
              title="Nenhum produto cadastrado"
              subtitle="Em breve adicionaremos muitas novidades aqui!"
            />
          ) : (
            <ProductGrid
              products={catalog.products}
              hasNextPage={catalog.hasNextPage}
              isFetchingNextPage={catalog.isFetchingNextPage}
              fetchNextPage={catalog.fetchNextPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
