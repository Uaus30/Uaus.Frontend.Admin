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
  /** Quantidade de produtos associados (mockado temporariamente) */
  productCount: number;
};

/**
 * Representa o produto retornado no relatório da etiqueta.
 */
export type TagReportProduct = {
  /** ID do produto */
  id: number;
  /** Nome do produto */
  name: string;
  /** Quantidade em estoque */
  stock: number;
  /** Quantidade total vendida */
  totalSales: number;
  /** Faturamento total gerado */
  totalRevenue: number;
};

/**
 * Representa a estrutura do relatório consolidado de vendas de uma etiqueta.
 */
export type TagReport = {
  /** Informações básicas da etiqueta */
  tag: {
    name: string;
    color: string;
  };
  /** Faturamento total de todos os produtos com esta etiqueta */
  totalRevenue: number;
  /** Total de itens vendidos com esta etiqueta */
  totalSales: number;
  /** Estoque total consolidado com esta etiqueta */
  totalStock: number;
  /** Lista de produtos associados com suas respectivas métricas */
  products: TagReportProduct[];
};
