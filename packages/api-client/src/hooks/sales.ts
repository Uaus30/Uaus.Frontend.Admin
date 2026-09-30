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
  ProductSaleDto,
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
    query?: Omit<
      UseQueryOptions<UiPagedResult<SaleDto>, ApiError, UiPagedResult<SaleDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
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
    query?: Omit<
      UseQueryOptions<UiPagedResult<SaleItemDto>, ApiError, UiPagedResult<SaleItemDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
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

export const getGetProductSalesQueryKey = (): QueryKey => ["product-sales"];

/**
 * Saídas de um produto: os itens de venda dele, da venda mais recente para a
 * mais antiga (ordenação do backend, pela data da VENDA). Alimenta a aba
 * Vendas da tela do produto.
 *
 * Desligado sem produto: o cadastro novo ainda não tem id.
 */
export function useGetProductSales(
  productId: number | null | undefined,
  params?: { page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<ProductSaleDto>, ApiError, UiPagedResult<ProductSaleDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  const page = params?.page ?? 1;
  const size = params?.limit ?? 20;
  return useQuery<UiPagedResult<ProductSaleDto>, ApiError, UiPagedResult<ProductSaleDto>, QueryKey>({
    queryKey: [...getGetProductSalesQueryKey(), productId ?? 0, { page, size }],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<ProductSaleDto>>(
        `/SaleItems/by-product/${productId}`,
        { page, size },
      );
      return mapPagedResult(result);
    },
    enabled: productId != null && productId > 0,
    ...options?.query,
  });
}
