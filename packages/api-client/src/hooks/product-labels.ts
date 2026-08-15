/**
 * Etiquetas de gôndola — lotes de impressão com histórico.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiDelete, ApiError, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  EnumValue,
  QueryKey,
  UiPagedResult,
} from "../models";

// ---------------------------------------------------------------------------
// Etiquetas de gôndola — lotes de impressão em A4 com histórico
//
// Contrato do backend em Uaus.Backend.Api/docs/etiquetas-de-gondola.md.
// ---------------------------------------------------------------------------

/**
 * Tipo visual da etiqueta de gôndola (enum ProductLabelType do backend).
 * Define a cor de fundo na impressão: Normal = branca, Promotion = amarela,
 * Clearance (queima de estoque) = vermelha.
 */
export const PRODUCT_LABEL_TYPE = {
  None: 0,
  Normal: 1,
  Promotion: 2,
  Clearance: 3,
} as const;

/** Um lote de etiquetas do histórico de impressão. */
export interface ProductLabelBatchDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  /** Identificação livre do lote (ex.: "Promoção da semana"). */
  description: string | null;
  userId: number | null;
  /** Nome completo de quem gerou o lote. */
  userName: string | null;
  /** Produtos distintos no lote. */
  totalProducts: number;
  /** Etiquetas que o lote imprime (soma das quantidades). */
  totalLabels: number;
  /** Itens. Preenchidos apenas na consulta por ID e na resposta da geração. */
  items: ProductLabelBatchItemDto[];
}

/**
 * Uma etiqueta do lote. Nome, código de barras e preço são congelados na
 * geração: a reimpressão reproduz o papel original mesmo que o cadastro do
 * produto mude depois.
 */
export interface ProductLabelBatchItemDto {
  id: number;
  productId: number;
  productName: string;
  barcode: string | null;
  /** Preço impresso — na promoção, o valor da oferta. */
  price: number;
  /** Enum ProductLabelType — pode vir como número ou nome; normalize com `enumCode()`. */
  labelType: EnumValue;
  /** Descrição do tipo em português, pronta para exibição. */
  labelTypeName: string;
  /** Cópias desta etiqueta no lote. */
  quantity: number;
}

/** Item enviado na geração de um lote. */
export interface CreateProductLabelBatchItemPayload {
  productId: number;
  /** Código numérico de PRODUCT_LABEL_TYPE (1, 2 ou 3). */
  labelType: number;
  /** Preço que sai impresso — na promoção, o valor da oferta. */
  price: number;
  /** Cópias da etiqueta (mínimo 1). */
  quantity: number;
}

/** Dados enviados ao gerar um lote de etiquetas. */
export interface CreateProductLabelBatchPayload {
  description?: string | null;
  items: CreateProductLabelBatchItemPayload[];
}

/** Chave de cache da listagem de lotes de etiquetas. */
export const getGetProductLabelBatchesQueryKey = (): QueryKey => ["ProductLabelBatches"];

/**
 * Lista os lotes de etiquetas do histórico, dos mais recentes para os mais
 * antigos.
 *
 * @param params `search` filtra pela identificação do lote.
 */
export function useGetProductLabelBatches(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<
        UiPagedResult<ProductLabelBatchDto>,
        ApiError,
        UiPagedResult<ProductLabelBatchDto>,
        QueryKey
      >,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<
    UiPagedResult<ProductLabelBatchDto>,
    ApiError,
    UiPagedResult<ProductLabelBatchDto>,
    QueryKey
  >({
    queryKey: [...getGetProductLabelBatchesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<ProductLabelBatchDto>>("/ProductLabelBatches", {
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Detalha um lote com os itens congelados, para exibição e reimpressão. */
export async function getProductLabelBatchById(id: number): Promise<ProductLabelBatchDto> {
  return apiGetOrThrow<ProductLabelBatchDto>(`/ProductLabelBatches/${id}`);
}

/**
 * Gera um lote de etiquetas. O backend congela nome e código de barras a
 * partir do cadastro; o preço vai no payload porque a oferta pode sair com
 * valor diferente do preço de venda.
 *
 * @returns O lote criado, já com os itens congelados.
 */
export async function createProductLabelBatch(
  data: CreateProductLabelBatchPayload,
): Promise<ProductLabelBatchDto | null> {
  const response = await apiPost<ProductLabelBatchDto>("/ProductLabelBatches", data);
  return response.data;
}

/** Remove um lote do histórico. Não afeta estoque nem produtos. */
export async function deleteProductLabelBatch(id: number): Promise<void> {
  await apiDelete<null>(`/ProductLabelBatches/${id}`);
}
