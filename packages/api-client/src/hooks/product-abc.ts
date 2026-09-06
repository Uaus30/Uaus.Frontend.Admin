/**
 * Curva ABC de produtos (`/ProductAbc`) — segunda tela do menu BI.
 *
 * Um endpoint só: a curva, a matriz, os achados e a lista saem do mesmo
 * varrimento do período, e separá-los faria a tela pedir quatro vezes o mesmo
 * recorte para montar uma leitura só.
 *
 * Campos anuláveis são declarados OPCIONAIS porque a API serializa com
 * `WhenWritingNull` — nulo não chega como `null`, o campo não vem.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";

/** O que ordena a curva. Chega e vai como número (enum do backend). */
export const ABC_CRITERION = {
  Revenue: 1,
  Profit: 2,
  Quantity: 3,
} as const;

export type AbcCriterion = (typeof ABC_CRITERION)[keyof typeof ABC_CRITERION];

/** Classe na curva. Chega como NOME do enum (`JsonStringEnumConverter`). */
export type AbcClass = "A" | "B" | "C" | "None";

/** Regularidade de venda dentro do período. Também chega como nome. */
export type SalesFrequency = "Constant" | "Occasional" | "Rare" | "None";

export interface ProductAbcSummaryDto {
  revenue: number;
  profit: number;
  margin: number;
  units: number;
  sales: number;
  products: number;

  classAProducts: number;
  classBProducts: number;
  classCProducts: number;

  /**
   * Quantos por cento dos produtos a loja precisou para chegar a 80%. É o
   * número que dá nome à tela — a regra de Pareto o presume em 20.
   */
  shareOfProductsForEightyPercent: number;

  /** Quanto do critério sai do quinto superior do catálogo. */
  shareFromTopFifthOfProducts: number;

  /** Gini de 0 a 1: a curva inteira resumida num número comparável. */
  concentrationIndex: number;

  averageTicket: number;
  stockCost: number;
  stockCostInClassC: number;
}

/** Um ponto da curva — os dois eixos em percentual acumulado. */
export interface AbcCurvePointDto {
  productShare: number;
  revenueShare: number;
  profitShare: number;
}

/** Uma célula do cruzamento faturamento × lucro. */
export interface AbcMatrixCellDto {
  revenueClass: AbcClass;
  profitClass: AbcClass;
  products: number;
  revenue: number;
  profit: number;
  revenueShare: number;
}

/** Um achado: quantos itens, quanto valem e quais são. */
export interface AbcFindingDto {
  products: number;
  revenue: number;
  profit: number;
  /** O valor que dá o tamanho do achado (capital parado, lucro, faturamento). */
  amount: number;
  /** Ids para a tela filtrar a tabela pelo achado. Vem truncado. */
  productIds: number[];
}

export interface AbcFindingsDto {
  revenueTraps: AbcFindingDto;
  hiddenGems: AbcFindingDto;
  tailThatPullsBasket: AbcFindingDto;
  misplacedStock: AbcFindingDto;
}

export interface ProductAbcItemDto {
  productId: number;
  productGroupId: number;
  productName: string;
  barcode: string;
  categoryName?: string | null;
  supplierName?: string | null;

  units: number;
  sales: number;
  revenue: number;
  profit: number;
  margin: number;

  share: number;
  cumulativeShare: number;
  rank: number;

  /** Classe pelo critério escolhido — a que a tabela exibe. */
  class: AbcClass;
  revenueClass: AbcClass;
  profitClass: AbcClass;
  frequency: SalesFrequency;
  weeksWithSales: number;

  /**
   * Ticket médio das vendas que contêm o produto, dividido pelo da loja. Acima
   * de 1, o item aparece em cestas maiores que a média.
   */
  basketLift: number;

  stock: number;
  stockCost: number;
  coverageDays?: number | null;
}

export interface ProductAbcReportDto {
  startDate: string;
  endDate: string;
  periodDays: number;
  criterion: AbcCriterion;
  summary: ProductAbcSummaryDto;
  curve: AbcCurvePointDto[];
  matrix: AbcMatrixCellDto[];
  findings: AbcFindingsDto;
  products: ProductAbcItemDto[];
}

export interface ProductAbcParams {
  startDate?: string;
  endDate?: string;
  criterion?: AbcCriterion;
}

/** Prefixo da chave; quem consulta acrescenta os parâmetros. */
export const getProductAbcQueryKey = (): QueryKey => ["product-abc"];

export async function getProductAbc(params?: ProductAbcParams) {
  return apiGetOrThrow<ProductAbcReportDto>("/ProductAbc", {
    startDate: params?.startDate,
    endDate: params?.endDate,
    criterion: params?.criterion,
  });
}

export function useGetProductAbc(
  params?: ProductAbcParams,
  options?: {
    query?: Omit<
      UseQueryOptions<ProductAbcReportDto, ApiError, ProductAbcReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<ProductAbcReportDto, ApiError, ProductAbcReportDto, QueryKey>({
    queryKey: [...getProductAbcQueryKey(), params ?? {}],
    queryFn: () => getProductAbc(params),
    ...options?.query,
  });
}
