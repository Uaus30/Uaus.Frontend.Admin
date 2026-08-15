/**
 * Estrutura de single Category item in the catalog.
 */
export type Category = {
  /** ID da categoria no banco. */
  id: number;
  /** Category display name */
  name: string;
  /** ID do departamento vinculado. */
  departmentId: number;
};

/**
 * Valores do formulário de cadastro/edição de Department.
 */
export type DepartmentForm = {
  /** Nome do departamento. */
  name: string;
  /** Optional department description */
  description: string;
};

/**
 * Estrutura de Department model enriched with child statistics values.
 */
export type EnrichedDepartment = {
  /** ID do departamento no banco. */
  id: number;
  /** Nome do departamento. */
  name: string;
  /** Optional department description */
  description?: string | null;
  /** Number of categories linked to this department */
  categoriesCount: number;
};
