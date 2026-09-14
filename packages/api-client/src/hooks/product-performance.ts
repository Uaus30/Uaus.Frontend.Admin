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
  capitalWeight: number;
  liquidityWeight: number;

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
  /** Custo de prateleira médio por produto COM saldo — a régua do capital. */
  averageStockCost: number;
  /** Dias que o estoque da loja inteira cobre — a régua da liquidez. */
  storeCoverageDays: number;
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
  /** Quanto POUCO dinheiro o produto prende, contra a média da loja. */
  capital: number;
  /** Em quanto tempo o saldo sai, contra o tempo que a loja leva. */
  liquidity: number;
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
  /** A parte de VENDA da nota, renormalizada — é ela que pesa o capital em risco. */
  salesScore: number;
  scoreBreakdown: ProductScoreBreakdownDto;
  class: ProductPerformanceClass;
  action: ProductActionCode;

  /** Capital parado ponderado pela nota de VENDA, mais o prejuízo já realizado. */
  capitalAtRisk: number;
  /** Lucro que a margem da loja teria produzido a mais no período. */
  missedProfit: number;
}

export interface ProductPerformanceReportDto {
  startDate: string;
  endDate: string;
  periodDays: number;
  /**
   * O dia da apuração guardada de onde o relatório veio. **Ausente significa
   * cálculo ao vivo** — os dois caminhos usam o mesmo código e só podem
   * divergir por idade, e idade é informação de quem decide.
   */
  snapshotAt?: string | null;
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

/** Um ponto da série de um produto: como ele estava num dia. */
export interface ProductPerformancePointDto {
  /** O dia da apuração, sem hora. */
  date: string;

  score: number;
  salesScore: number;
  scoreBreakdown: ProductScoreBreakdownDto;

  class: ProductPerformanceClass;
  action: ProductActionCode;

  /** Posição entre os JULGADOS. **Zero é "ainda não julgado"** — era novo naquele dia. */
  rank: number;
  /** Quantos disputavam posição — o analisado menos o novo. */
  analysedProducts: number;

  units: number;
  revenue: number;
  profit: number;
  margin: number;
  stock: number;
  stockCost: number;
  sellThrough: number;
  coverageDays?: number | null;
  capitalAtRisk: number;
  missedProfit: number;
}

/** O desempenho de UM produto: onde ele está e como chegou até aqui. */
export interface ProductPerformanceProfileDto {
  productId: number;
  productName: string;

  /** A última apuração. **Ausente quando o produto ainda não foi apurado.** */
  current?: ProductPerformancePointDto | null;

  /** As réguas da loja na última apuração. Ausente junto com `current`. */
  parameters?: ProductPerformanceParametersDto | null;

  /** A série, do mais ANTIGO para o mais recente — a ordem em que o gráfico desenha. */
  history: ProductPerformancePointDto[];
}

/** Prefixo da chave; quem consulta acrescenta os parâmetros. */
export const getProductPerformanceQueryKey = (): QueryKey => ["product-performance"];

/** Prefixo da chave da última apuração. */
export const getLatestProductPerformanceQueryKey = (): QueryKey => ["product-performance", "ultima"];

/** Prefixo da chave do perfil de um produto. */
export const getProductPerformanceProfileQueryKey = (): QueryKey => ["product-performance", "produto"];

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

/**
 * O mesmo relatório, a partir da última apuração diária.
 *
 * É o caminho do período padrão, e o que faz a tela abrir rápido: leitura
 * indexada, sem varrer venda nenhuma. Medido em 13/09/2026 com 888 produtos:
 * **~340 ms contra ~1.190 ms** do cálculo ao vivo.
 *
 * O servidor cai no cálculo ao vivo sozinho quando ainda não há apuração — o
 * primeiro dia, antes das 19h —, e aí `snapshotAt` vem ausente. A tela lê esse
 * campo para dizer o que está mostrando.
 */
export async function getLatestProductPerformance(limit?: number) {
  return apiGetOrThrow<ProductPerformanceReportDto>("/ProductPerformance/ultima", { limit });
}

export function useGetLatestProductPerformance(
  limit?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<ProductPerformanceReportDto, ApiError, ProductPerformanceReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<ProductPerformanceReportDto, ApiError, ProductPerformanceReportDto, QueryKey>({
    queryKey: [...getLatestProductPerformanceQueryKey(), limit ?? 100],
    queryFn: () => getLatestProductPerformance(limit),
    ...options?.query,
  });
}

/**
 * A foto e a série de um produto — a aba Desempenho da tela do produto.
 *
 * `productId` é a VARIAÇÃO, e não o grupo: é ela que tem estoque, preço e nota.
 */
export async function getProductPerformanceProfile(productId: number, days?: number) {
  return apiGetOrThrow<ProductPerformanceProfileDto>(`/ProductPerformance/produto/${productId}`, {
    days,
  });
}

export function useGetProductPerformanceProfile(
  productId: number | null | undefined,
  days?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<ProductPerformanceProfileDto, ApiError, ProductPerformanceProfileDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<ProductPerformanceProfileDto, ApiError, ProductPerformanceProfileDto, QueryKey>({
    queryKey: [...getProductPerformanceProfileQueryKey(), productId ?? 0, days ?? 90],
    queryFn: () => getProductPerformanceProfile(productId as number, days),
    enabled: Boolean(productId),
    ...options?.query,
  });
}
