/**
 * Grades — REEXPORT, não implementação.
 *
 * A implementação está em `packages/api-client/src/hooks/grades.ts`. Ficam de
 * fora, de propósito, duas funções que existiam aqui:
 *
 * - `getGradesPage`, que não tinha um único chamador e descrevia um contrato
 *   que o backend não tem: `GET /Grades` não é paginado.
 * - o `fetchAllPages` que sustentava `getAllGrades`. Pela mesma razão — a
 *   varredura paginada sobre uma lista crua estourava em `[...undefined]`. A
 *   versão do api-client faz um GET simples; o JSDoc de lá explica.
 *
 * Importadores restantes: `hooks/use-catalog.ts` (`getAllGrades`) e
 * `features/products` (`getGradesByCategoryId`). A feature de grades já usa os
 * hooks. Não acrescente função aqui.
 */

export {
  createGrade,
  deleteGrade,
  getAllGrades,
  getGradesByCategoryId,
  updateGrade,
} from "@workspace/api-client-react";
