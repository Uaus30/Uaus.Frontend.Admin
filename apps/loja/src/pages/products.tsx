import { useEffect } from "react";
import { Loader2, PackageOpen, RefreshCcw, SearchX } from "lucide-react";
import { Link } from "wouter";
import { usePageTitle } from "@/lib/page-title";
import { catalogPath } from "@/routes";
import { useCatalog } from "@/features/catalog/hooks/useCatalog";
import { ActiveFilters } from "@/features/catalog/components/ActiveFilters";
import { CatalogFilters } from "@/features/catalog/components/CatalogFilters";
import { CatalogFilterSheet } from "@/features/catalog/components/CatalogFilterSheet";
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
      <Icon className="h-12 w-12 text-primary" aria-hidden />
      <p className="text-xl font-bold text-foreground">{title}</p>
      <p className="max-w-md text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

/** Saída dos estados vazios com filtro — sem ela o visitante fica preso no beco. */
function ClearFiltersLink() {
  return (
    <Link
      href={catalogPath()}
      className="mt-2 rounded-xl bg-primary-strong px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      Ver todos os produtos
    </Link>
  );
}

/**
 * Vitrine de produtos. A página só renderiza o que `useCatalog` devolve —
 * query, busca, filtro e paginação moram no hook (regra do CLAUDE.md §4).
 */
export default function ProductsPage() {
  const catalog = useCatalog();
  const { selectedCategoryName, selectedDepartmentName } = catalog.tree;

  // O título da aba é o do filtro: é ele que aparece no histórico do navegador
  // e na aba compartilhada — "Uaus | Produtos" em toda categoria não distingue
  // nada.
  const filterLabel = selectedCategoryName ?? selectedDepartmentName;
  usePageTitle(filterLabel ? `Uaus | ${filterLabel}` : "Uaus | Produtos");

  const { departmentId, categoryId } = catalog.filters;

  useEffect(() => {
    // Troca de filtro sobe a página. O `ScrollToTop` global NÃO cobre este
    // caso: o `useLocation` do wouter lê só o pathname, e filtro mexe na query
    // string. Sem esta linha, quem filtra no meio da lista continua no meio,
    // agora olhando produtos de outra categoria.
    window.scrollTo({ top: 0 });
  }, [departmentId, categoryId]);

  return (
    <div className="min-h-screen bg-surface pb-24">
      <section className="mb-14 bg-primary pt-16 pb-14 text-center">
        <div className="mx-auto max-w-3xl px-4">
          {filterLabel ? (
            <>
              <h1 className="text-3xl font-black text-foreground md:text-5xl">{filterLabel}</h1>
              {selectedCategoryName && selectedDepartmentName && (
                <p className="mt-4 font-semibold text-foreground/80">{selectedDepartmentName}</p>
              )}
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-foreground/75 md:text-5xl">
                Promoções e <span className="text-foreground">Novidades</span>
              </h1>
              <p className="mt-4 text-foreground/80">Todas as imagens são meramente ilustrativas.</p>
            </>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <CatalogSearch
          value={catalog.search}
          onChange={catalog.setSearch}
          isSearching={catalog.isSearching}
        />

        <div className="mt-4 flex justify-center lg:hidden">
          <CatalogFilterSheet
            departments={catalog.tree.departments}
            isLoading={catalog.tree.isLoading}
            totalCount={catalog.tree.totalCount}
            filters={catalog.filters}
          />
        </div>

        <div className="mt-4">
          <ActiveFilters
            filters={catalog.filters}
            departmentName={selectedDepartmentName}
            categoryName={selectedCategoryName}
          />
        </div>

        {catalog.totalCount > 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {catalog.totalCount === 1 ? "1 produto" : `${catalog.totalCount} produtos`}
            {catalog.hasFilters ? (catalog.totalCount === 1 ? " encontrado" : " encontrados") : " na loja"}
          </p>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <CatalogFilters
                departments={catalog.tree.departments}
                isLoading={catalog.tree.isLoading}
                totalCount={catalog.tree.totalCount}
                filters={catalog.filters}
              />
            </div>
          </aside>

          <div>
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
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-strong px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-primary focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Tentar de novo
                </button>
              </StateMessage>
            ) : catalog.tree.isUnknownFilter ? (
              <StateMessage
                icon={SearchX}
                title="Esse filtro não existe mais"
                subtitle="O departamento ou a categoria do link saiu do site — mas a loja continua cheia."
              >
                <ClearFiltersLink />
              </StateMessage>
            ) : catalog.isFilterEmpty ? (
              <StateMessage
                icon={SearchX}
                title="Nada encontrado com esse filtro"
                subtitle="Tente outro departamento, outra categoria ou veja a vitrine inteira."
              >
                <ClearFiltersLink />
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
    </div>
  );
}
