/**
 * "O que trouxe lucro" (`/ProfitLeaders`) — os produtos que sozinhos compõem
 * metade do lucro do período.
 *
 * Um endpoint só: pódio, ranking e resumo saem do mesmo varrimento, e o gráfico
 * de cada linha vem junto com ela.
 *
 * Enum **de ida** viaja como número (query string); enum **de volta** chega como
 * NOME, porque a API serializa com `JsonStringEnumConverter`. Campo anulável é
 * declarado opcional: com `WhenWritingNull` o nulo não chega como `null`, o campo
 * simplesmente não vem.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";

/**
 * Os períodos que a tela oferece. Vai como número.
 *
 * `AllTime` é resolvido no SERVIDOR: só o banco sabe quando foi a primeira venda
 * da loja, e mandar a tela chutar uma data antiga faria o cabeçalho anunciar um
 * período que a loja não viveu.
 */
export const PROFIT_LEADERS_PERIOD = {
  Last30Days: 1,
  Last90Days: 2,
  PreviousMonth: 3,
  CurrentMonth: 4,
  AllTime: 5,
  Custom: 6,
} as const;

export type ProfitLeadersPeriod = (typeof PROFIT_LEADERS_PERIOD)[keyof typeof PROFIT_LEADERS_PERIOD];

/** O mesmo período como a resposta o devolve. */
export type ProfitLeadersPeriodName =
  "Last30Days" | "Last90Days" | "PreviousMonth" | "CurrentMonth" | "AllTime" | "Custom";

/**
 * O que o produto é NESTE período — o motivo da posição dele.
 *
 * A tendência tem precedência sobre a frequência: um produto que vendeu
 * regularmente e depois morreu é `Declining`, não `Workhorse`.
 */
export type ProfitArchetypeName = "Newcomer" | "Rising" | "Workhorse" | "Steady" | "Declining";

/**
 * O ponto de atenção da linha — NUNCA um defeito do produto.
 *
 * Todo item desta tela é vencedor por definição; o alerta responde "o que olhar
 * neste aqui". Caiu com estoque em casa é demanda a investigar; caiu sem estoque
 * é compra a fazer.
 */
export type ProfitAlertName = "None" | "ParkedStock" | "StockOut" | "LowCoverage";

/** Um intervalo do eixo X dos gráficos de linha. */
export interface ProfitBucketDto {
  startDate: string;
  endDate: string;
  /** Rótulo curto já pronto — "08/09", "set/26". */
  label: string;
  /**
   * O intervalo está recortado e cobre menos dias que os pares. O ÚLTIMO quase
   * sempre é: em 30 dias a quinta semana cobre dois dias. Sem tratar, o gráfico
   * de todo produto termina num mergulho que não aconteceu.
   */
  isPartial: boolean;
}

/** O que a loja fez no período, e o que o corte representa dentro disso. */
export interface ProfitLeadersSummaryDto {
  /** Lucro LÍQUIDO do período — prejuízo descontado. O que a loja ganhou. */
  profit: number;
  /**
   * Lucro só de quem lucrou, prejuízo truncado em zero. É a BASE de todas as
   * fatias percentuais: numerador e denominador têm de vir do mesmo conjunto, e
   * dividir pelo líquido dava fatia acima de 100%.
   */
  generatedProfit: number;
  revenue: number;
  marginPercentage: number;

  /** Produtos distintos com lucro positivo no período. */
  productsWithProfit: number;
  /** Quantos entraram no corte — a manchete da tela. */
  leaderCount: number;
  leaderProfit: number;
  /** Fica em torno de 50%, não cravado: o último líder entra inteiro. */
  leaderShare: number;
  /** Que percentual dos produtos com lucro o corte representa. */
  leaderShareOfProducts: number;

  /** A régua da segunda leitura, contra a qual cada linha é alta ou baixa. */
  medianProfitPerUnit: number;

  /** Líderes em queda que têm saldo em casa — o maior bloco da tela. */
  decliningLeaders: number;
  decliningStockUnits: number;
  decliningStockCost: number;
}

/** Uma linha do ranking. */
export interface ProfitLeaderDto {
  /** Posição no corte, a partir de 1. 1, 2 e 3 sobem ao pódio. */
  rank: number;

  productId: number;
  productGroupId: number;
  /** Nome composto (grupo + grade) quando o produto tem variação. */
  productName: string;
  barcode: string;
  categoryName?: string | null;
  supplierName?: string | null;

  /** Ordena o ranking. */
  profit: number;
  /**
   * A segunda régua. Um produto de 20 peças a R$ 10 de lucro cada pesa tanto
   * quanto um de 300 peças a R$ 0,70 — e eles pedem ações opostas.
   */
  profitPerUnit: number;
  revenue: number;
  marginPercentage: number;
  units: number;
  sales: number;

  share: number;
  /** No último líder, ultrapassa 50%. */
  cumulativeShare: number;

  stock: number;
  stockCost: number;
  /** Ausente quando não houve peça vendida para dar ritmo. */
  coverageDays?: number | null;

  /** Primeira venda da HISTÓRIA do produto, não a do período. */
  firstSaleDate?: string | null;
  /** Semanas do período em que vendeu — a régua da constância. */
  weeksWithSales: number;
  periodWeeks: number;

  /** Lucro no último quarto do período — o "agora". */
  recentProfit: number;
  recentDays: number;
  /** Lucro nos dias anteriores a esse quarto — o "vinha fazendo". */
  earlierProfit: number;
  earlierDays: number;
  /**
   * Variação do RITMO DIÁRIO entre as duas janelas. Ausente quando não havia
   * ritmo anterior — sair do zero não é variação de 0%.
   */
  trendPercentage?: number | null;

  archetype: ProfitArchetypeName;
  alert: ProfitAlertName;

  /**
   * Lucro por intervalo, na mesma ordem de `buckets`. Vazia quando o período
   * rende menos de quatro intervalos: tendência sobre três pontos é ruído com
   * cara de diagnóstico.
   */
  history: number[];
}

export interface ProfitLeadersReportDto {
  startDate: string;
  endDate: string;
  periodDays: number;
  period: ProfitLeadersPeriodName;
  summary: ProfitLeadersSummaryDto;
  /** O eixo X compartilhado por todos os gráficos. Vazio em período curto. */
  buckets: ProfitBucketDto[];
  leaders: ProfitLeaderDto[];
}

export interface ProfitLeadersParams {
  period?: ProfitLeadersPeriod;
  /** Só usados quando `period` é `Custom`. */
  startDate?: string;
  endDate?: string;
}

/** Prefixo da chave; quem consulta acrescenta os parâmetros. */
export const getProfitLeadersQueryKey = (): QueryKey => ["profit-leaders"];

export async function getProfitLeaders(params?: ProfitLeadersParams) {
  return apiGetOrThrow<ProfitLeadersReportDto>("/ProfitLeaders", {
    period: params?.period,
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

export function useGetProfitLeaders(
  params?: ProfitLeadersParams,
  options?: {
    query?: Omit<
      UseQueryOptions<ProfitLeadersReportDto, ApiError, ProfitLeadersReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<ProfitLeadersReportDto, ApiError, ProfitLeadersReportDto, QueryKey>({
    queryKey: [...getProfitLeadersQueryKey(), params ?? {}],
    queryFn: () => getProfitLeaders(params),
    ...options?.query,
  });
}
