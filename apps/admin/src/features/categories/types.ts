import type { CategoryDto, DepartmentDto } from "@workspace/api-client-react";

/**
 * Tipos da feature de categorias.
 *
 * Regra do repositório: `types.ts` REEXPORTA os DTOs do api-client e define
 * apenas o que é de formulário ou de view. Redeclarar o DTO à mão cria duas
 * verdades sobre a mesma resposta do servidor — foi o que aconteceu aqui, e a
 * consequência direta foi um `map((category: any) => ...)` no hook, porque o
 * tipo local não batia com o que a API devolvia.
 */

export type { CategoryDto, DepartmentDto };

/** Departamento, no que a tela de categorias usa dele. */
export type Department = Pick<DepartmentDto, "id" | "name">;

/** Valores do formulário de cadastro/edição de categoria. */
export type CategoryForm = {
  /** ID do departamento escolhido. String porque vem de um `<select>`. */
  departmentId: string;
  name: string;
  description: string;
};

/**
 * Categoria com o departamento já resolvido para exibição.
 *
 * Deriva do DTO em vez de repetir seus campos: um campo novo no backend passa a
 * existir aqui sozinho, e um campo removido vira erro de compilação em vez de
 * `undefined` silencioso na tela.
 */
export type EnrichedCategory = CategoryDto & {
  /** Departamento correspondente, ou `null` quando o catálogo ainda não chegou. */
  department: Department | null;
  /** Produtos ativos vinculados, contados pela API na própria listagem. */
  productCount: number;
};

export type { CategoryReport, CatalogReportProduct as CategoryReportProduct } from "@/services/mappers";
