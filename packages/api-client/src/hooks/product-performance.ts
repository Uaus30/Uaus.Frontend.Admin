/**
 * Desempenho de produtos (`/ProductPerformance`) — terceira tela do menu BI.
 *
 * Um endpoint só, como a curva ABC: os dois rankings, a comparação entre eles e
 * o tamanho de cada ação sugerida saem do MESMO varrimento do período. Separá-los
 * faria a tela pedir quatro vezes o mesmo recorte, e — pior — abriria a chance de
 * as réguas da loja (giro, margem, lucro médio) serem calculadas duas vezes sobre
 * conjuntos ligeiramente diferentes.
 *
 * Campos anuláveis são declarados OPCIONAIS porque a API serializa com
 * `WhenWritingNull` — nulo não chega como `null`, o campo não vem.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";
import type { SalesFrequency } from "./product-abc";

/** Faixa do produto no período. Chega como NOME do enum (`JsonStringEnumConverter`). */
export type ProductPerformanceClass = "Standout" | "Steady" | "Weak" | "Stalled" | "New" | "None";

/** A decisão que o produto está pedindo. Uma só por produto. */
export type ProductActionCode = "None" | "RaisePrice" | "Restock" | "Replicate" | "Burn";

/** Pesos, cortes e as médias da loja que servem de régua para a nota. */
export interface ProductPerformanceParametersDto {
  turnoverWeight: number;
  marginWeight: number;
  resultWeight: number;
  consistencyWeight: number;

  standoutScore: number;
  steadyScore: number;
  goodScore: number;

  lowMarginThreshold: number;
  healthyMarginThreshold: number;
  shortCoverageDays: number;
  excessCoverageDays: number;
  newProductDays: number;

  /** Percentual do que existia que a LOJA escoou no período. */
  storeSellThrough: number;
  storeMargin: number;
  averageProfitPerProduct: number;
}

export interface ProductPerformanceTotalsDto {
  /** Produtos analisados: venderam no período ou têm saldo em casa. */
  products: number;
  soldProducts: number;
  stalledProducts: number;
  /** Entraram há poucos dias e nunca venderam — ficam fora dos dois rankings. */
  newProducts: number;

  revenue: number;
  profit: number;
  margin: number;
  units: number;
  sales: number;

  stockUnits: number;
  stockCost: number;
  stalledStockCost: number;
  capitalAtRisk: number;
  sellThrough: number;
}

/** Um lado da comparação — os cem melhores ou os cem piores, somados. */
export interface ProductGroupSummaryDto {
  products: number;
  units: number;
  revenue: number;
  profit: number;
  margin: number;
  stockCost: number;
  capitalAtRisk: number;
  sellThrough: number;
  averageScore: number;
  /** Quanto do lucro do período este grupo produziu. */
  profitShare: number;
  /** Quanto do capital em estoque este grupo imobiliza. */
  stockCostShare: number;
}

export interface ProductPerformanceComparisonDto {
  best: ProductGroupSummaryDto;
  worst: ProductGroupSummaryDto;
}

/** Uma ação sugerida, com quantos produtos a pedem e quanto ela vale. */
export interface ProductSuggestionDto {
  action: ProductActionCode;
  products: number;
  /** O tamanho da ação em reais — cada ação mede uma coisa diferente. */
  amount: number;
  revenue: number;
  profit: number;
  stockCost: number;
}

export interface ProductScoreBreakdownDto {
  turnover: number;
  margin: number;
  result: number;
  consistency: number;
}

export interface ProductPerformanceItemDto {
  productId: number;
  productGroupId: number;
  productName: string;
  barcode: string;
  categoryName?: string | null;
  supplierName?: string | null;

  rank: number;

  units: number;
  sales: number;
  revenue: number;
  profit: number;
  margin: number;

  price: number;
  costPrice: number;

  stock: number;
  stockCost: number;
  /** Percentual do que existia do produto que saiu no período. */
  sellThrough: number;
  /** Dias que o saldo cobre no ritmo do período. Ausente sem venda. */
  coverageDays?: number | null;

  weeksWithSales: number;
  frequency: SalesFrequency;

  lastSaleAt?: string | null;
  daysWithoutSelling?: number | null;
  daysInStore?: number | null;

  score: number;
  scoreBreakdown: ProductScoreBreakdownDto;
  class: ProductPerformanceClass;
  action: ProductActionCode;

  /** Capital parado ponderado pela nota, mais o prejuízo já realizado. */
  capitalAtRisk: number;
  /** Lucro que a margem da loja teria produzido a mais no período. */
  missedProfit: number;
}

export interface ProductPerformanceReportDto {
  startDate: string;
  endDate: string;
  periodDays: number;
  parameters: ProductPerformanceParametersDto;
  totals: ProductPerformanceTotalsDto;
  comparison: ProductPerformanceComparisonDto;
  suggestions: ProductSuggestionDto[];
  best: ProductPerformanceItemDto[];
  worst: ProductPerformanceItemDto[];
}

export interface ProductPerformanceParams {
  startDate?: string;
  endDate?: string;
  /** Tamanho de cada ranking. Padrão do backend: 100. */
  limit?: number;
}

/** Prefixo da chave; quem consulta acrescenta os parâmetros. */
export const getProductPerformanceQueryKey = (): QueryKey => ["product-performance"];

export async function getProductPerformance(params?: ProductPerformanceParams) {
  return apiGetOrThrow<ProductPerformanceReportDto>("/ProductPerformance", {
    startDate: params?.startDate,
    endDate: params?.endDate,
    limit: params?.limit,
  });
}

export function useGetProductPerformance(
  params?: ProductPerformanceParams,
  options?: {
    query?: Omit<
      UseQueryOptions<ProductPerformanceReportDto, ApiError, ProductPerformanceReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<ProductPerformanceReportDto, ApiError, ProductPerformanceReportDto, QueryKey>({
    queryKey: [...getProductPerformanceQueryKey(), params ?? {}],
    queryFn: () => getProductPerformance(params),
    ...options?.query,
  });
}
