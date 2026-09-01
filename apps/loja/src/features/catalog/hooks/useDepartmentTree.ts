import { useMemo } from "react";
import { useGetStorefrontDepartments } from "@workspace/api-client-react";
import type { CatalogFilters } from "@/routes";
import type { CatalogCategory, CatalogDepartment } from "../types";

export interface DepartmentTreeState {
  departments: CatalogDepartment[];
  isLoading: boolean;
  isError: boolean;
  /** Produtos visíveis com a busca atual — o mesmo total que a grade devolve. */
  totalCount: number;
  selectedDepartment?: CatalogDepartment;
  selectedCategory?: CatalogCategory;
  /** Nome do filtro escolhido, mesmo quando a busca o tirou da lista. */
  selectedDepartmentName?: string;
  selectedCategoryName?: string;
  /** Filtro na URL que não existe na vitrine — link velho ou cadastro removido. */
  isUnknownFilter: boolean;
}

/** Acha a categoria por id em qualquer departamento da árvore. */
function findCategory(departments: CatalogDepartment[], categoryId?: number): CatalogCategory | undefined {
  if (categoryId === undefined) return undefined;
  return departments
    .flatMap((department) => department.categories)
    .find((category) => category.id === categoryId);
}

/**
 * Árvore de departamentos e categorias da vitrine, resolvida contra o filtro
 * atual.
 *
 * São DUAS leituras do mesmo endpoint, com papéis diferentes:
 *
 * - com a busca, é a lista que a tela mostra. A contagem sai da MESMA regra da
 *   grade, e é isso que impede a faceta de mentir: sem a busca, "Cozinha (7)"
 *   apareceria ao lado de três cards.
 * - sem a busca, é o retrato estável do catálogo — quais filtros existem e como
 *   se chamam. Ele responde o que a lista filtrada não consegue: uma busca
 *   estreita pode tirar da árvore justamente a categoria escolhida, e sem esse
 *   retrato o chip ficaria sem rótulo e a tela acusaria "filtro inexistente"
 *   para um cadastro que existe.
 *
 * O custo é menor do que parece: sem busca as duas dividem a mesma chave de
 * cache e viram uma requisição só, e o retrato é buscado uma vez por visita.
 */
export function useDepartmentTree(filters: CatalogFilters): DepartmentTreeState {
  const query = useGetStorefrontDepartments(filters.search);
  const catalog = useGetStorefrontDepartments(undefined);

  const departments = useMemo(() => query.data ?? [], [query.data]);
  const allDepartments = useMemo(() => catalog.data ?? [], [catalog.data]);

  const selectedDepartment = departments.find((item) => item.id === filters.departmentId);
  const selectedCategory = findCategory(departments, filters.categoryId);

  // O que o catálogo inteiro conhece — a busca não influencia.
  const knownDepartment = allDepartments.find((item) => item.id === filters.departmentId);
  const knownCategory = findCategory(allDepartments, filters.categoryId);

  return {
    departments,
    isLoading: query.isLoading,
    isError: query.isError,
    totalCount: departments.reduce((total, department) => total + department.productCount, 0),
    selectedDepartment,
    selectedCategory,
    selectedDepartmentName: selectedDepartment?.name ?? knownDepartment?.name,
    selectedCategoryName: selectedCategory?.name ?? knownCategory?.name,
    // "Não existe" é afirmado contra o catálogo inteiro, nunca contra a lista
    // filtrada: sumir da busca é "nada casou", que é outra mensagem, com outro
    // conserto, que "esse filtro saiu do site".
    isUnknownFilter:
      !catalog.isLoading &&
      !catalog.isError &&
      ((filters.departmentId !== undefined && !knownDepartment) ||
        (filters.categoryId !== undefined && !knownCategory)),
  };
}
