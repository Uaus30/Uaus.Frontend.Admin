/**
 * Vendas — listagem, detalhe e itens.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  QueryKey,
  SaleDto,
  SaleItemDto,
  UiPagedResult,
} from "../models";

export const getGetSalesQueryKey = (): QueryKey => ["sales"];

export function useGetSales(
  params?: {
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethodId?: number;
    paymentStatus?: number;
    page?: number;
    limit?: number;
  },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>({
    queryKey: [...getGetSalesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<SaleDto>>("/Sales", {
        search: params?.search,
        startDate: params?.startDate,
        endDate: params?.endDate,
        paymentMethodId: params?.paymentMethodId,
        paymentStatus: params?.paymentStatus,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

// useCreateSale e useDeleteSale foram removidos: nenhum consumidor nos dois apps.
// A venda pelo painel usa createSaleWithItems, que lanca os itens junto; a do
// balcao usa POST /Pdv/sales. Tipar `data: unknown` neles seria arrumar codigo morto.

export function useGetSaleDetails(
  id?: number,
  options?: {
    query?: Omit<UseQueryOptions<SaleDto, ApiError, SaleDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<SaleDto, ApiError, SaleDto, QueryKey>({
    queryKey: ["sale-details", id ?? 0],
    queryFn: async () => {
      return await apiGetOrThrow<SaleDto>(`/Sales/${id}`);
    },
    enabled: !!id,
    ...options?.query,
  });
}

export function useGetSaleItems(
  params?: { saleId?: number; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<SaleItemDto>, ApiError, UiPagedResult<SaleItemDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<SaleItemDto>, ApiError, UiPagedResult<SaleItemDto>, QueryKey>({
    queryKey: ["sale-items-by-sale-id", params?.saleId ?? 0, params?.page ?? 1, params?.limit ?? 100],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<SaleItemDto>>("/SaleItems", {
        saleId: params?.saleId,
        page: params?.page ?? 1,
        size: params?.limit ?? 100,
      });
      return mapPagedResult(result);
    },
    enabled: !!params?.saleId,
    ...options?.query,
  });
}
