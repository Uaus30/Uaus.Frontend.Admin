/**
 * "O que mudou" (`/PeriodComparison`) — a tela de BI que compara dois períodos.
 *
 * Um endpoint só: os quatro blocos saem do mesmo par de varrimentos, e separá-los
 * faria a tela pedir quatro vezes os mesmos dois recortes para montar uma leitura
 * que só existe junta.
 *
 * Enum **de ida** viaja como número (query string); enum **de volta** chega como
 * NOME, porque a API serializa com `JsonStringEnumConverter`. Campo anulável é
 * declarado opcional: com `WhenWritingNull` o nulo não chega como `null`, o campo
 * simplesmente não vem.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";

/** Eixo da quebra. Vai como número. */
export const COMPARISON_DIMENSION = {
  Category: 1,
  Department: 2,
  Product: 3,
  Supplier: 4,
} as const;

export type ComparisonDimension = (typeof COMPARISON_DIMENSION)[keyof typeof COMPARISON_DIMENSION];

/** O mesmo eixo como a resposta o devolve. */
export type ComparisonDimensionName = "Category" | "Department" | "Product" | "Supplier";

/**
 * As parcelas em que a diferença de faturamento é repartida.
 *
 * As quatro primeiras MULTIPLICAM o faturamento com item; `Unattributed` é
 * SOMADA — faturamento sem item não tem peça, logo não tem fator.
 */
export type RevenueFactorName =
  "OpenDays" | "SalesPerDay" | "UnitsPerSale" | "RevenuePerUnit" | "Unattributed";

/** Como a linha se comportou entre os dois períodos. */
export type ChangeStatusName = "Grew" | "Shrank" | "Entered" | "Left" | "Stable";

/** O que o item-evento fez com o período. */
export type EventKindName = "Vanished" | "Emerged";

/** Um dos dois lados da comparação. */
export interface ComparisonWindowDto {
  startDate: string;
  endDate: string;
  /** Dias corridos do intervalo. */
  days: number;
  /** Dias em que a loja vendeu — o denominador do movimento. */
  openDays: number;

  revenue: number;
  /** A parte do faturamento que tem item por trás — a base da ponte e do mix. */
  itemRevenue: number;
  /** Faturamento cobrado sem item: `revenue − itemRevenue`. Normalmente zero. */
  unattributedRevenue: number;
  profit: number;
  marginPercentage: number;
  sales: number;
  /** Peças que saíram da prateleira. */
  units: number;
  averageTicket: number;

  salesPerDay: number;
  unitsPerSale: number;
  revenuePerUnit: number;
}

/** Uma barra da ponte. */
export interface RevenueFactorDto {
  factor: RevenueFactorName;
  previousValue: number;
  currentValue: number;
  /** Ausente quando não havia base para dividir — sair de zero não é 0%. */
  changePercentage?: number | null;
  /** Reais atribuídos à parcela. As CINCO somam a diferença do período. */
  amount: number;
  /** Peso sobre a soma dos módulos das cinco parcelas. */
  shareOfMovement: number;
}

/** Uma linha do bloco "quem mudou". */
export interface DimensionChangeDto {
  /** Nulo no balde residual e na linha "outras N". */
  id?: number | null;
  name: string;

  previousRevenue: number;
  currentRevenue: number;
  revenueDelta: number;
  revenueDeltaPercentage?: number | null;

  previousProfit: number;
  currentProfit: number;
  profitDelta: number;

  previousUnits: number;
  currentUnits: number;
  previousAveragePrice: number;
  currentAveragePrice: number;

  previousShare: number;
  currentShare: number;
  shareOfMovement: number;

  status: ChangeStatusName;

  /**
   * A linha é um balde, não uma linha da dimensão: "Sem item identificado",
   * "Sem fornecedor no lote" ou "Outras N linhas". Baldes nomeados ficam fora do
   * corte das 60 linhas.
   */
  isBucket: boolean;
}

/** A contribuição de uma linha para os dois efeitos. */
export interface MixPriceContributionDto {
  id?: number | null;
  name: string;
  previousUnitShare: number;
  currentUnitShare: number;
  previousAveragePrice: number;
  currentAveragePrice: number;
  mixEffect: number;
  priceEffect: number;
  totalEffect: number;
}

/** A variação do valor da peça repartida entre mix e preço. */
export interface MixPriceSplitDto {
  /**
   * A régua da divisão — sempre `Category`, e NÃO a dimensão escolhida na tela.
   * A fronteira entre mix e preço é a granularidade; deixá-la seguir o seletor
   * faria a recomendação se inverter quando o usuário troca de seletor.
   */
  measuredBy: ComparisonDimensionName;
  previousRevenuePerUnit: number;
  currentRevenuePerUnit: number;
  change: number;
  mixEffect: number;
  priceEffect: number;
  /**
   * O mesmo efeito em reais: por peça, vezes as peças do período atual.
   * NÃO é a barra "valor por peça" da ponte e não soma com ela — a barra reparte
   * também o efeito cruzado com os outros fatores, que é outra pergunta.
   */
  mixAmount: number;
  priceAmount: number;
  contributions: MixPriceContributionDto[];
}

/** O item que sozinho moveu o período. */
export interface EventItemDto {
  productId: number;
  productName: string;
  barcode: string;
  categoryName?: string | null;

  previousRevenue: number;
  currentRevenue: number;
  revenueDelta: number;
  previousShare: number;
  currentShare: number;
  previousUnits: number;
  currentUnits: number;

  /** O que sobrou do evento na prateleira. */
  stock: number;
  stockCost: number;

  kind: EventKindName;
}

export interface PeriodComparisonReportDto {
  previous: ComparisonWindowDto;
  current: ComparisonWindowDto;
  dimension: ComparisonDimensionName;
  bridge: RevenueFactorDto[];
  changes: DimensionChangeDto[];
  mixPrice: MixPriceSplitDto;
  eventItems: EventItemDto[];
}

export interface PeriodComparisonParams {
  previousStartDate?: string;
  previousEndDate?: string;
  currentStartDate?: string;
  currentEndDate?: string;
  dimension?: ComparisonDimension;
}

/** Prefixo da chave; quem consulta acrescenta os parâmetros. */
export const getPeriodComparisonQueryKey = (): QueryKey => ["period-comparison"];

export async function getPeriodComparison(params?: PeriodComparisonParams) {
  return apiGetOrThrow<PeriodComparisonReportDto>("/PeriodComparison", {
    previousStartDate: params?.previousStartDate,
    previousEndDate: params?.previousEndDate,
    currentStartDate: params?.currentStartDate,
    currentEndDate: params?.currentEndDate,
    dimension: params?.dimension,
  });
}

export function useGetPeriodComparison(
  params?: PeriodComparisonParams,
  options?: {
    query?: Omit<
      UseQueryOptions<PeriodComparisonReportDto, ApiError, PeriodComparisonReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<PeriodComparisonReportDto, ApiError, PeriodComparisonReportDto, QueryKey>({
    queryKey: [...getPeriodComparisonQueryKey(), params ?? {}],
    queryFn: () => getPeriodComparison(params),
    ...options?.query,
  });
}
