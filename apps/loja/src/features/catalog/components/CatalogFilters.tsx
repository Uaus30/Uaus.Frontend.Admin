import { Link } from "wouter";
import { Skeleton } from "@workspace/ui";
import { catalogPath, type CatalogFilters as Filters } from "@/routes";
import type { CatalogDepartment } from "../types";

interface FilterLinkProps {
  href: string;
  label: string;
  count: number;
  isActive: boolean;
  onSelect?: () => void;
}

/**
 * Um item da lista de filtros.
 *
 * É LINK, não botão: filtro é navegação de verdade (muda a URL, entra no
 * histórico, pode ser compartilhado). Link ainda ganha de graça o clique do
 * meio, o "abrir em nova aba" e — o que mais importa para uma loja — a
 * rastreabilidade pelo buscador, que não clica em botão nenhum.
 */
function FilterLink({ href, label, count, isActive, onSelect }: FilterLinkProps) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      aria-current={isActive ? "true" : undefined}
      className={
        isActive
          ? "flex items-center justify-between gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-bold text-primary"
          : "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
      }
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{count}</span>
    </Link>
  );
}

interface CatalogFiltersProps {
  departments: CatalogDepartment[];
  isLoading: boolean;
  /** Total da vitrine com a busca atual — o número do "Todos os produtos". */
  totalCount: number;
  filters: Filters;
  /** Chamado depois de escolher; é como a gaveta do celular se fecha. */
  onSelect?: () => void;
}

/**
 * Lista de filtros da vitrine: departamentos e, dentro do escolhido, as
 * categorias.
 *
 * As categorias aparecem só do departamento aberto. Mostrar a árvore inteira
 * transformaria a coluna numa lista de dezenas de linhas — e o visitante que
 * chega pelo celular já rolou a página antes de ver o primeiro produto.
 *
 * A contagem vem do servidor com a MESMA busca da grade, então "Cozinha (3)"
 * entrega três produtos. Clicar no item já selecionado desliga o filtro: o
 * `href` dele aponta para a vitrine sem aquele nível.
 */
export function CatalogFilters({
  departments,
  isLoading,
  totalCount,
  filters,
  onSelect,
}: CatalogFiltersProps) {
  const { departmentId, categoryId, search } = filters;

  if (isLoading) {
    return (
      <div className="space-y-2" aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Filtrar por departamento">
      <p className="px-3 pb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        Departamentos
      </p>

      <ul className="space-y-1">
        <li>
          <FilterLink
            href={catalogPath({ search })}
            label="Todos os produtos"
            count={totalCount}
            isActive={departmentId === undefined && categoryId === undefined}
            onSelect={onSelect}
          />
        </li>

        {departments.map((department) => {
          const isOpen = department.id === departmentId;

          return (
            <li key={department.id}>
              <FilterLink
                href={isOpen ? catalogPath({ search }) : catalogPath({ departmentId: department.id, search })}
                label={department.name}
                count={department.productCount}
                isActive={isOpen && categoryId === undefined}
                onSelect={onSelect}
              />

              {isOpen && department.categories.length > 0 && (
                <ul className="mt-1 ml-4 space-y-0.5 border-l border-border pl-2">
                  {department.categories.map((category) => (
                    <li key={category.id}>
                      <FilterLink
                        href={catalogPath({
                          departmentId: department.id,
                          categoryId: category.id === categoryId ? undefined : category.id,
                          search,
                        })}
                        label={category.name}
                        count={category.productCount}
                        isActive={category.id === categoryId}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
