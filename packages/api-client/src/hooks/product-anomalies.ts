/**
 * "Anomalias" (`/ProductAnomalies`) — o que está errado agora no cadastro.
 *
 * Um endpoint só, sem parâmetro: cada consulta varre o catálogo inteiro e nada
 * é persistido — nem a anomalia, nem a lista, nem a resolução. O produto sai da
 * lista quando a causa é corrigida no cadastro.
 *
 * Enum de volta chega como NOME (`JsonStringEnumConverter`). Campo anulável é
 * declarado opcional: com `WhenWritingNull` o nulo não chega como `null`, o
 * campo simplesmente não vem.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { QueryKey } from "../models";

/**
 * Os tipos de anomalia, na ordem de prioridade do backend: o primeiro perde
 * dinheiro ou trava a venda agora, o último é só confuso.
 */
export type ProductAnomalyTypeName =
  | "PriceBelowCost"
  | "DraftWithStock"
  | "PhantomStock"
  | "MarkedOutOfStock"
  | "ZeroCost"
  | "InactiveWithStock"
  | "MissingPhoto"
  | "HiddenFromStorefront"
  | "DuplicateName";

/** Os números da regra do estoque fantasma — o manual da tela fala com eles. */
export interface ProductAnomalyRulesDto {
  /** Saldo menor que isto já é baixo. */
  lowStockMinUnits: number;
  /** Fração da última compra que também é estoque baixo (0,10 = 10%). */
  lowStockEntryShare: number;
  /** Vendas mínimas na janela para o produto "vir vendendo". */
  phantomMinWindowSales: number;
  /** Vendas esperadas no silêncio a partir das quais a regra acende. */
  phantomMinExpectedSales: number;
  /** Janela máxima do ritmo, em dias. */
  phantomWindowDays: number;
}

export interface ProductAnomalyCountDto {
  type: ProductAnomalyTypeName;
  /** Cadastros (grupos), não variações. */
  groups: number;
}

/** A conta que acendeu o estoque fantasma. */
export interface PhantomStockEvidenceDto {
  /** O maior entre 5 e 10% da última compra. */
  lowStockThreshold: number;
  lastPurchaseQuantity?: number | null;
  lastPurchaseAt?: string | null;
  lastSaleAt: string;
  /** De quando o silêncio conta: a última venda ou a última compra. */
  silenceSince: string;
  /** Vendas (cupons) do produto na janela. */
  windowSales: number;
  /** Vendas da loja na mesma janela. */
  windowStoreSales: number;
  /** Vendas da loja desde o silêncio, nenhuma com o produto. */
  storeSalesSinceSilence: number;
  /** Quantas vezes ele teria aparecido no silêncio, no ritmo dele. */
  expectedSales: number;
}

/** Uma anomalia com a evidência. Só vêm os campos do tipo. */
export interface ProductAnomalyDto {
  type: ProductAnomalyTypeName;
  /** A variação afetada. Ausente nas anomalias do cadastro inteiro (foto, site, nome). */
  productId?: number | null;
  /** Nome composto da variação ("CANECA [AZUL]"). */
  productName?: string | null;
  price?: number | null;
  /** Custo do cadastro: o do lote mais recente. */
  costPrice?: number | null;
  /** Custo de um lote antigo ainda com saldo que passa do preço — é o que a próxima venda congela. */
  lotCost?: number | null;
  stock?: number | null;
  /** A entrada mais recente da variação — a única cujo custo a tela corrige. */
  lastEntryId?: number | null;
  lastEntryDate?: string | null;
  /** Unidades em estoque que saem com custo R$ 0,00, somadas de todos os lotes zerados com saldo. */
  zeroCostUnits?: number | null;
  /**
   * A entrada do lote zerado mais recente com saldo. Igual a `lastEntryId`: a tela
   * corrige. Diferente: o zero está numa entrada anterior, e a correção é por script.
   */
  zeroCostEntryId?: number | null;
  zeroCostEntryDate?: string | null;
  phantom?: PhantomStockEvidenceDto | null;
  /** Os outros cadastros com o mesmo nome. */
  duplicateGroupIds?: number[] | null;
}

/** Uma linha: um cadastro com as anomalias dele. */
export interface ProductAnomalyRowDto {
  /** Id do GRUPO — é ele que abre a tela de detalhe do produto. */
  productGroupId: number;
  name: string;
  imageUrl?: string | null;
  categoryName?: string | null;
  hasVariations: boolean;
  /** Saldo somado das variações vivas. */
  stock: number;
  /** Da mais grave para a menos grave. */
  anomalies: ProductAnomalyDto[];
}

export interface ProductAnomaliesReportDto {
  /** Quando a varredura foi feita, no horário da loja. */
  generatedAt: string;
  rules: ProductAnomalyRulesDto;
  counts: ProductAnomalyCountDto[];
  items: ProductAnomalyRowDto[];
}

/** Prefixo da chave. Não há parâmetro: a varredura é sempre do catálogo inteiro. */
export const getProductAnomaliesQueryKey = (): QueryKey => ["product-anomalies"];

export async function getProductAnomalies() {
  return apiGetOrThrow<ProductAnomaliesReportDto>("/ProductAnomalies");
}

export function useGetProductAnomalies(options?: {
  query?: Omit<
    UseQueryOptions<ProductAnomaliesReportDto, ApiError, ProductAnomaliesReportDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<ProductAnomaliesReportDto, ApiError, ProductAnomaliesReportDto, QueryKey>({
    queryKey: getProductAnomaliesQueryKey(),
    queryFn: () => getProductAnomalies(),
    ...options?.query,
  });
}
