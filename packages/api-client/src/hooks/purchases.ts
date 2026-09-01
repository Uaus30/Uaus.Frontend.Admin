/**
 * Compras e inventário — entradas de compra e relatório de estoque.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiDelete, ApiError, useCrudMutation, mapPagedResult } from "../client";
import type { BackendPagedResult, EnumValue, QueryKey, UiPagedResult } from "../models";

// ==========================================
// INVENTORY & PURCHASE ENTRIES TYPES & HOOKS
// ==========================================

export interface PurchaseEntryDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  supplierId: number;
  entryDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  total: number;
  /**
   * Enum PurchaseEntryType — chega como NOME (`"ManualAdjustment"`), não como
   * código. Normalize com `enumCode(valor, PURCHASE_ENTRY_TYPE)` na fronteira.
   */
  type: EnumValue;
}

export interface ReceivedPurchaseEntryItemDto {
  id: number;
  stockLotId: number;
  productId: number;
  productName: string;
  barcode: string;
  imageUrl: string | null;
  productPrice: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  availableQuantity: number;
  hasConsumedStock: boolean;
}

export interface ReceivedPurchaseEntryDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  supplierId: number;
  supplierName: string;
  entryDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  total: number;
  /** Quem lançou. Nulos nas notas anteriores a 31/08/2026, quando o autor passou a ser gravado. */
  userId: number | null;
  userName: string | null;
  canEdit: boolean;
  canDelete: boolean;
  items: ReceivedPurchaseEntryItemDto[];
}

export interface ReceivePurchaseEntryItemRequest {
  productId: number;
  quantity: number;
  unitCost: number;
  price: number;
}

export interface ReceivePurchaseEntryRequest {
  supplierId: number;
  entryDate: string;
  invoiceNumber: string | null;
  notes: string | null;
  /**
   * Chave de idempotência (UUID, um por lançamento). Um retry depois de timeout
   * reenvia a mesma chave e recebe a nota já gravada em vez de duplicar lote e
   * estoque — índice único parcial no backend, no molde de vendas e baixas.
   */
  clientReference?: string | null;
  items: ReceivePurchaseEntryItemRequest[];
}

export interface InventoryMetricsDto {
  totalProductsWithControl: number;
  totalUnits: number;
  totalValueMerchandise: number;
  totalValueCost: number;
  totalEstimatedProfit: number;
  marginPercentage: number;
  alertsNoStock: number;
  alertsLowStock: number;
}

export interface CategoryInventorySummaryDto {
  categoryName: string;
  productsCount: number;
  unitsCount: number;
  merchandiseValue: number;
  estimatedProfit: number;
  percentageOfTotalValue: number;
}

export interface InventoryItemDto {
  id: number;
  productName: string;
  barcode: string;
  supplierName: string;
  categoryName: string;
  stock: number;
  unitCost: number;
  unitSale: number;
  totalCost: number;
  mercadoria: number;
  estimatedProfit: number;
  marginPercentage: number;
}

export interface BackendInventoryReportDto {
  metrics: InventoryMetricsDto;
  categorySummaries: CategoryInventorySummaryDto[];
  items: BackendPagedResult<InventoryItemDto>;
}

export interface InventoryReportDto {
  metrics: InventoryMetricsDto;
  categorySummaries: CategoryInventorySummaryDto[];
  items: UiPagedResult<InventoryItemDto>;
}

/**
 * Chave de cache da listagem de entradas de compra.
 *
 * Só o PREFIXO, como manda o README: quem consulta acrescenta os parâmetros em
 * `[...getGetPurchaseEntriesQueryKey(), params ?? {}]`. É o prefixo que faz a
 * invalidação alcançar TODAS as páginas e filtros de uma vez — sem ele, salvar
 * uma entrada estando na página 2 deixaria a página 1 com dados velhos, e a
 * nota recém-lançada só apareceria depois de um F5.
 */
export const getGetPurchaseEntriesQueryKey = (): QueryKey => ["purchase-entries"];

export function useGetPurchaseEntries(
  params?: {
    supplierId?: number;
    productId?: number;
    barcode?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<PurchaseEntryDto>, ApiError, UiPagedResult<PurchaseEntryDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<PurchaseEntryDto>, ApiError, UiPagedResult<PurchaseEntryDto>, QueryKey>({
    queryKey: [...getGetPurchaseEntriesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<PurchaseEntryDto>>("/PurchaseEntries", {
        supplierId: params?.supplierId,
        productId: params?.productId,
        barcode: params?.barcode,
        startDate: params?.startDate,
        endDate: params?.endDate,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useGetPurchaseEntryDetails(
  id: number,
  options?: {
    query?: Omit<
      UseQueryOptions<ReceivedPurchaseEntryDto, ApiError, ReceivedPurchaseEntryDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<ReceivedPurchaseEntryDto, ApiError, ReceivedPurchaseEntryDto, QueryKey>({
    queryKey: ["purchase-entry-details", id],
    enabled: !!id,
    queryFn: async () => {
      return apiGetOrThrow<ReceivedPurchaseEntryDto>(`/PurchaseEntries/${id}/details`);
    },
    ...options?.query,
  });
}

export function useReceivePurchaseEntry(options?: {
  mutation?: UseMutationOptions<ReceivedPurchaseEntryDto, ApiError, { data: ReceivePurchaseEntryRequest }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<ReceivedPurchaseEntryDto>("/PurchaseEntries/receive", data);
    if (!response.data) throw new Error("Não foi possível obter os dados da entrada.");
    return response.data;
  }, options);
}

export function useDeletePurchaseEntry(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/PurchaseEntries/${id}`);
    return response.data;
  }, options);
}

export function useGetInventoryReport(
  params?: {
    search?: string;
    supplierId?: number;
    categoryId?: number;
    stockStatus?: string;
    page?: number;
    limit?: number;
  },
  options?: {
    query?: Omit<
      UseQueryOptions<InventoryReportDto, ApiError, InventoryReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<InventoryReportDto, ApiError, InventoryReportDto, QueryKey>({
    queryKey: ["inventory-report", params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendInventoryReportDto>("/Inventory", {
        search: params?.search,
        supplierId: params?.supplierId,
        categoryId: params?.categoryId,
        stockStatus: params?.stockStatus,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return {
        metrics: result.metrics,
        categorySummaries: result.categorySummaries,
        items: mapPagedResult(result.items),
      };
    },
    ...options?.query,
  });
}
