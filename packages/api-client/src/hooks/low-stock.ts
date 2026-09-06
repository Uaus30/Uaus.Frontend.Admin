/**
 * Relatório de estoque baixo (`/LowStock`) e o "resolvido" por item.
 *
 * A contagem tem hook próprio porque o painel e o topo da listagem de produtos
 * só precisam saber SE há pendência para acender o alerta vermelho — baixar a
 * lista a cada abertura do painel seria pagar pelo relatório sem abri-lo.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, QueryKey, UiPagedResult } from "../models";

/** Uma linha do relatório: o produto, o saldo contra o mínimo e o estado do alerta. */
export interface LowStockItemDto {
  productId: number;
  /** Id do GRUPO — é ele que abre a tela de detalhe do produto. */
  productGroupId: number;
  /** Nome composto (grupo + grades). */
  productName: string;
  barcode: string;
  categoryName: string;
  /**
   * Fornecedor do lote mais recente. Ausente em produto sem lote: o backend
   * serializa com `WhenWritingNull`, então nulo chega como campo omitido.
   */
  supplierName?: string | null;
  /** Caminho relativo da foto principal; passe por `buildPublicImageUrl`. Ausente sem foto. */
  imageUrl?: string | null;
  stock: number;
  minStock: number;
  price: number;
  costPrice: number;
  /** Quando o alerta foi marcado como resolvido. Ausente = pendente. */
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  isResolved: boolean;
}

/** Contagem do alerta. `pending > 0` acende o vermelho. */
export interface LowStockSummaryDto {
  pending: number;
  resolved: number;
}

/**
 * Prefixo do recurso. Lista e contagem ficam SOB ele de propósito: resolver um
 * item invalida o prefixo e as duas atualizam juntas — a tela do relatório e o
 * alerta do painel não podem discordar sobre quantos faltam.
 */
export const getGetLowStockQueryKey = (): QueryKey => ["low-stock"];

/** Chave da contagem. Quem consulta a lista acrescenta os parâmetros ao prefixo. */
export const getGetLowStockSummaryQueryKey = (): QueryKey => [...getGetLowStockQueryKey(), "summary"];

export interface LowStockParams {
  /** Falso (padrão) devolve só o que ainda acende o alerta. */
  includeResolved?: boolean;
  /** Mesma busca das demais telas de produto (nome, descrição, código, grade). */
  search?: string;
  page?: number;
  limit?: number;
}

/** Página do relatório: pendentes primeiro, depois resolvidos; do menor saldo para o maior. */
export function useGetLowStock(
  params?: LowStockParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<LowStockItemDto>, ApiError, UiPagedResult<LowStockItemDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<LowStockItemDto>, ApiError, UiPagedResult<LowStockItemDto>, QueryKey>({
    queryKey: [...getGetLowStockQueryKey(), "page", params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<LowStockItemDto>>("/LowStock", {
        includeResolved: params?.includeResolved ?? false,
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Contagem de pendentes e resolvidos. Um minuto de `staleTime`: o alerta é
 * lido no painel e na listagem de produtos, e o número muda com venda e
 * entrada — não a cada clique.
 */
export function useGetLowStockSummary(options?: {
  query?: Omit<
    UseQueryOptions<LowStockSummaryDto, ApiError, LowStockSummaryDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<LowStockSummaryDto, ApiError, LowStockSummaryDto, QueryKey>({
    queryKey: getGetLowStockSummaryQueryKey(),
    queryFn: () => apiGetOrThrow<LowStockSummaryDto>("/LowStock/summary"),
    staleTime: 60_000,
    ...options?.query,
  });
}

/** Marca o alerta do produto como resolvido. Cai sozinho na próxima entrada de estoque. */
export async function resolveLowStock(productId: number): Promise<LowStockItemDto> {
  const response = await apiPost<LowStockItemDto>(`/LowStock/${productId}/resolve`, {});
  if (!response.data) throw new Error("Não foi possível marcar o alerta como resolvido.");
  return response.data;
}

/** Desfaz a marca: o produto volta a acender o alerta. */
export async function reopenLowStock(productId: number): Promise<LowStockItemDto | null> {
  const response = await apiDelete<LowStockItemDto>(`/LowStock/${productId}/resolve`);
  return response.data ?? null;
}
