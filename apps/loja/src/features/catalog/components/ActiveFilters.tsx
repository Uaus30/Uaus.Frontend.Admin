import { X } from "lucide-react";
import { Link } from "wouter";
import { catalogPath, type CatalogFilters as Filters } from "@/routes";

interface ChipProps {
  label: string;
  /** Para onde vai ao tirar ESTE filtro; os outros continuam valendo. */
  href: string;
}

function Chip({ label, href }: ChipProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white py-1.5 pr-2 pl-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
    >
      <span className="max-w-[14rem] truncate">{label}</span>
      <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="sr-only">Remover filtro {label}</span>
    </Link>
  );
}

interface ActiveFiltersProps {
  filters: Filters;
  /** Nome do departamento escolhido; ausente enquanto a árvore não chegou. */
  departmentName?: string;
  categoryName?: string;
}

/**
 * O que está filtrando agora, em fichas removíveis.
 *
 * Existe porque no celular a lista de filtros mora numa gaveta fechada: sem as
 * fichas, o visitante vê uma vitrine curta e nenhuma pista de que ele mesmo a
 * encurtou. Cada ficha tira só o próprio filtro; "Limpar tudo" volta à vitrine
 * inteira, busca incluída.
 */
export function ActiveFilters({ filters, departmentName, categoryName }: ActiveFiltersProps) {
  const { departmentId, categoryId, search } = filters;
  const hasAny = departmentId !== undefined || categoryId !== undefined || Boolean(search);

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {departmentId !== undefined && departmentName && (
        // Tirar o departamento tira a categoria junto: categoria pertence a um
        // departamento, e a combinação órfã devolveria vitrine vazia.
        <Chip label={departmentName} href={catalogPath({ search })} />
      )}

      {categoryId !== undefined && categoryName && (
        <Chip label={categoryName} href={catalogPath({ departmentId, search })} />
      )}

      {search && <Chip label={`"${search}"`} href={catalogPath({ departmentId, categoryId })} />}

      <Link
        href={catalogPath()}
        className="rounded-full px-3 py-1.5 text-sm font-semibold text-primary underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:outline-none"
      >
        Limpar tudo
      </Link>
    </div>
  );
}
