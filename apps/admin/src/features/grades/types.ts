import type { Grade, GradeVariant, GradeType } from "../products/types";

export type { Grade, GradeVariant, GradeType };

/**
 * Representa os valores do formulário para criação ou edição de uma Grade.
 */
export type GradeForm = {
  /** Tipo da grade (Cor, Tamanho, Modelo, Estampa) */
  type: GradeType;
  /** IDs das categorias associadas a esta grade */
  categoryIds: number[];
  /** Lista de opções (variantes) associadas */
  variants: GradeVariant[];
};
