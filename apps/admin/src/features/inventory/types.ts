/**
 * Representa um item de produto no inventário de estoque.
 */
export type InventoryItem = {
  /** ID do produto */
  id: number;
  /** Nome do produto */
  productName: string;
  /** Código de barras EAN/GTIN */
  barcode: string | null;
  /** Nome do fornecedor associado */
  supplierName: string;
  /** Nome da categoria associada */
  categoryName: string;
  /** Quantidade física atual em estoque */
  stock: number;
  /** Custo unitário de aquisição */
  unitCost: number;
  /** Preço unitário de venda */
  unitSale: number;
  /** Valor total em mercadoria (stock * unitSale) */
  mercadoria: number;
  /** Custo total em mercadoria (stock * unitCost) */
  totalCost: number;
  /** Lucro total estimado (mercadoria - totalCost) */
  estimatedProfit: number;
  /** Margem percentual estimada */
  marginPercentage: number;
};

/**
 * Resumo consolidado de estoque por categoria de produto.
 */
export type InventoryCategorySummary = {
  /** Nome da categoria */
  categoryName: string;
  /** Percentual do valor de venda desta categoria em relação ao total geral */
  percentageOfTotalValue: number;
  /** Quantidade de produtos únicos cadastrados */
  productsCount: number;
  /** Quantidade total física de unidades em estoque */
  unitsCount: number;
  /** Valor total em mercadoria de venda */
  merchandiseValue: number;
  /** Lucro total estimado na categoria */
  estimatedProfit: number;
};

/**
 * Indicadores e métricas de estoque consolidadas do inventário.
 */
export type InventoryMetrics = {
  /** Total de produtos únicos cadastrados com controle de estoque ativo */
  totalProductsWithControl: number;
  /** Total físico de unidades em estoque */
  totalUnits: number;
  /** Valor total acumulado de venda (Preço de Venda) */
  totalValueMerchandise: number;
  /** Valor total acumulado de custo (Capital Investido) */
  totalValueCost: number;
  /** Lucro total estimado consolidado */
  totalEstimatedProfit: number;
  /** Margem de lucro consolidada */
  marginPercentage: number;
  /** Alerta: quantidade de produtos zerados em estoque */
  alertsNoStock: number;
  /** Alerta: quantidade de produtos com estoque abaixo do mínimo */
  alertsLowStock: number;
};

/**
 * Estrutura do relatório completo de inventário retornado da API.
 */
export type InventoryReport = {
  /** Métricas globais consolidadas */
  metrics: InventoryMetrics;
  /** Resumos analíticos por categoria */
  categorySummaries: InventoryCategorySummary[];
  /** Resultados paginados dos itens de produto */
  items: {
    data: InventoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
