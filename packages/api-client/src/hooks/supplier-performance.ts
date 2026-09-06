/**
 * Desempenho de fornecedores (`/SupplierPerformance`) — a primeira tela do
 * menu BI.
 *
 * São dois endpoints porque são dois custos: o ranking devolve 16 linhas e o
 * detalhe devolve o mix de produtos de UM fornecedor, que pode passar de
 * quatrocentos. Carregar os dois juntos faria a listagem pagar por mil produtos
 * para não mostrar nenhum.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";

/**
 * Pesos e réguas do cálculo da nota, como o servidor os aplicou.
 *
 * Viajam com a resposta de propósito: a tela precisa deles para explicar cada
 * nota ("atinge 69% da margem média da loja"), e repetir os números no front
 * criaria duas verdades sobre a mesma regra — a primeira a divergir em silêncio
 * seria a explicação, não o cálculo.
 */
export interface SupplierPerformanceParametersDto {
  /** Percentual do estoque escoado no período que vale nota cheia. */
  turnoverTarget: number;
  /** Aproveitamento do mix que vale nota cheia. */
  hitRateTarget: number;
  /** Piso de margem para um produto contar como bom. */
  goodMarginThreshold: number;
  /** Dias de casa abaixo dos quais um produto que nunca vendeu não é julgado. */
  newProductDays: number;
  /** Cobertura de estoque considerada saudável, em dias. */
  healthyCoverageDays: number;
  hitRateWeight: number;
  marginWeight: number;
  turnoverWeight: number;
  resultWeight: number;
  /** Aproveitamento médio da loja — régua do componente de mix. */
  storeHitRate: number;
  /** Margem média da loja no período — régua do componente de margem. */
  storeMargin: number;
  /** Lucro médio por fornecedor ativo — régua do componente de resultado. */
  averageProfitPerSupplier: number;
}

/** Totais do conjunto FILTRADO, não da loja inteira. */
export interface SupplierPerformanceTotalsDto {
  revenue: number;
  previousRevenue: number;
  profit: number;
  margin: number;
  sales: number;
  units: number;
  stockCost: number;
  /** Custo parado em produtos que não venderam no período. */
  stalledStockCost: number;
  activeSuppliers: number;
  totalSuppliers: number;
  goodProducts: number;
  judgedProducts: number;
}

/** As quatro notas parciais que compõem a nota final. */
export interface SupplierScoreBreakdownDto {
  hitRate: number;
  margin: number;
  turnover: number;
  result: number;
}

/** Uma linha do ranking. */
export interface SupplierPerformanceDto {
  supplierId: number;
  supplierName: string;
  avatarColor: string | null;
  isRecurring: boolean;
  isMarketplace: boolean;

  sales: number;
  units: number;
  distinctProducts: number;
  revenue: number;
  profit: number;
  margin: number;
  averageTicket: number;
  revenueShare: number;
  profitShare: number;
  /** Variação contra o período anterior de igual duração. Nula sem base. */
  revenueChangePercent: number | null;

  stockUnits: number;
  stockCost: number;
  turnover: number;
  /** Dias para escoar o estoque no ritmo do período. Nula sem venda. */
  coverageDays: number | null;
  /** Lucro do período por real parado em estoque. Nulo sem estoque. */
  stockReturn: number | null;

  totalProducts: number;
  judgedProducts: number;
  goodProducts: number;
  lowMarginProducts: number;
  stalledProducts: number;
  newProducts: number;
  inactiveProducts: number;
  /** Percentual de produtos julgados que vendem com boa margem. */
  hitRate: number;
  stalledStockCost: number;

  lastSaleDate: string | null;
  daysWithoutSelling: number | null;
  lastPurchaseDate: string | null;
  daysWithoutBuying: number | null;
  purchaseCountLastYear: number;
  purchaseTotalLastYear: number;
  averagePurchaseIntervalDays: number | null;

  repricedProducts: number;
  averageCostIncreasePercent: number | null;

  score: number;
  scoreBreakdown: SupplierScoreBreakdownDto;
  /** Faturamento de cada dia do período, do mais antigo ao mais recente. */
  dailyRevenue: number[];
}

export interface SupplierPerformanceReportDto {
  startDate: string;
  endDate: string;
  periodDays: number;
  parameters: SupplierPerformanceParametersDto;
  totals: SupplierPerformanceTotalsDto;
  /** Já ordenado da melhor para a pior nota pelo servidor. */
  suppliers: SupplierPerformanceDto[];
}

/**
 * Classe do produto no período. Chega como NOME do enum (o backend registra
 * `JsonStringEnumConverter`), então compare por string.
 */
export type SupplierProductClass = "Good" | "LowMargin" | "Stalled" | "New" | "Inactive" | "None";

export interface SupplierProductPerformanceDto {
  productId: number;
  /** Id do GRUPO — é ele que abre a tela de detalhe do produto. */
  productGroupId: number;
  productName: string;
  barcode: string;
  price: number;

  soldUnits: number;
  revenue: number;
  profit: number;
  margin: number;

  /** Saldo disponível nos lotes DESTE fornecedor. */
  stock: number;
  stockCost: number;
  coverageDays: number | null;

  lastSaleDate: string | null;
  daysWithoutSelling: number | null;
  daysInStore: number | null;

  currentCost: number | null;
  previousCost: number | null;
  /** Variação do custo entre as duas últimas compras. Nula com uma só. */
  costChangePercent: number | null;

  classification: SupplierProductClass;
  /** Quantidade sugerida para repor. Zero quando não há urgência. */
  suggestedPurchase: number;
}

export interface SupplierContactDto {
  salesRepresentative: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  minimumPurchaseValue: number;
  description: string | null;
}

export interface SupplierDetailDto {
  startDate: string;
  endDate: string;
  periodDays: number;
  parameters: SupplierPerformanceParametersDto;
  /** A mesma linha do ranking, com os mesmos números. */
  summary: SupplierPerformanceDto;
  contact: SupplierContactDto;
  /** Quantos produtos fazem 80% do faturamento do fornecedor. */
  productsForEightyPercent: number;
  products: SupplierProductPerformanceDto[];
}

/** Recorte do relatório. Sem datas, o servidor devolve os últimos 30 dias. */
export interface SupplierPerformanceParams {
  startDate?: string;
  endDate?: string;
  onlyRecurring?: boolean;
}

/**
 * Prefixo das chaves. Quem consulta acrescenta os parâmetros — a factory
 * devolve só o prefixo, que é o que deixa uma invalidação alcançar todos os
 * recortes de uma vez.
 */
export const getSupplierPerformanceQueryKey = (): QueryKey => ["supplier-performance"];
export const getSupplierPerformanceDetailQueryKey = (): QueryKey => ["supplier-performance-detail"];

export async function getSupplierPerformance(params?: SupplierPerformanceParams) {
  return apiGetOrThrow<SupplierPerformanceReportDto>("/SupplierPerformance", {
    startDate: params?.startDate,
    endDate: params?.endDate,
    onlyRecurring: params?.onlyRecurring,
  });
}

export async function getSupplierPerformanceDetail(supplierId: number, params?: SupplierPerformanceParams) {
  return apiGetOrThrow<SupplierDetailDto>(`/SupplierPerformance/${supplierId}`, {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function useGetSupplierPerformance(
  params?: SupplierPerformanceParams,
  options?: {
    query?: Omit<
      UseQueryOptions<SupplierPerformanceReportDto, ApiError, SupplierPerformanceReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<SupplierPerformanceReportDto, ApiError, SupplierPerformanceReportDto, QueryKey>({
    queryKey: [...getSupplierPerformanceQueryKey(), params ?? {}],
    queryFn: () => getSupplierPerformance(params),
    ...options?.query,
  });
}

export function useGetSupplierPerformanceDetail(
  supplierId: number | null,
  params?: SupplierPerformanceParams,
  options?: {
    query?: Omit<
      UseQueryOptions<SupplierDetailDto, ApiError, SupplierDetailDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<SupplierDetailDto, ApiError, SupplierDetailDto, QueryKey>({
    queryKey: [...getSupplierPerformanceDetailQueryKey(), supplierId, params ?? {}],
    queryFn: () => getSupplierPerformanceDetail(supplierId!, params),
    enabled: supplierId !== null && supplierId > 0,
    ...options?.query,
  });
}
