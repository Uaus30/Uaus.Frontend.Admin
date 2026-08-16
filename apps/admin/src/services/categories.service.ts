/**
 * Categorias e departamentos — REEXPORT, não implementação.
 *
 * A implementação mudou de casa: caminho HTTP, tradução de `limit` para `size`
 * e DTO agora vivem em `packages/api-client/src/hooks/categories.ts`, como manda
 * a seção 3 do CLAUDE.md. Este arquivo continua existindo só porque três pontos
 * do admin ainda o importam por `@/services/categories.service`:
 *
 * - `hooks/use-catalog.ts` (`getAllCategories`, `getAllDepartments`);
 * - `features/departments` (a página inteira de departamentos);
 * - `features/sales` (catálogo para os filtros do relatório).
 *
 * Não acrescente função aqui. Quando esses três passarem a importar os hooks do
 * api-client (`useGetCategories`, `useGetDepartments`, `useCreateCategory`…),
 * este arquivo some — é isso que o reexport torna possível sem um passo grande
 * e arriscado: ninguém precisa mudar de import e de implementação no mesmo
 * commit.
 */

export {
  createCategory,
  createDepartment,
  deleteCategory,
  deleteDepartment,
  getAllCategories,
  getAllDepartments,
  getCategoriesPage,
  getDepartmentsPage,
  updateCategory,
  updateDepartment,
} from "@workspace/api-client-react";
