/**
 * Representa os valores do formulário para criação ou edição de uma Etiqueta (Tag).
 */
export type TagForm = {
  /** Nome da etiqueta */
  name: string;
  /** Cor hexadecimal da etiqueta */
  color: string;
  /** Se a etiqueta deve ser visível publicamente no catálogo */
  isPublic: boolean;
};

/**
 * Representa o modelo de Etiqueta (Tag) com dados adicionais ou enriquecidos.
 */
export type EnrichedTag = {
  /** ID único da etiqueta no banco de dados */
  id: number;
  /** Nome da etiqueta */
  name: string;
  /** Cor hexadecimal da etiqueta */
  color: string;
  /** Se é pública */
  isPublic: boolean;
  /** Data de criação da etiqueta */
  createdAt: string;
  /** Produtos ativos marcados com a etiqueta, contados pela API na própria listagem */
  productCount: number;
};

export type { TagReport, CatalogReportProduct as TagReportProduct } from "@/services/mappers";
