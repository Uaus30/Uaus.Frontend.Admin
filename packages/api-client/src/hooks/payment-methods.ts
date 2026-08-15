/**
 * Formas de pagamento e parcelamento.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete, ApiError, useCrudMutation, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  CreatePaymentMethodRequest,
  PaymentMethodDto,
  QueryKey,
  UiPagedResult,
  UpdatePaymentMethodRequest,
} from "../models";


// Payment Methods Hooks

/** Chave de cache da listagem de formas de pagamento. */
export const getGetPaymentMethodsQueryKey = (): QueryKey => ["PaymentMethods"];

export function useGetPaymentMethods(
  params?: { search?: string; isActive?: boolean; page?: number; size?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<PaymentMethodDto>, ApiError, UiPagedResult<PaymentMethodDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<PaymentMethodDto>, ApiError, UiPagedResult<PaymentMethodDto>, QueryKey>({
    queryKey: [...getGetPaymentMethodsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<PaymentMethodDto>>("/PaymentMethods", {
        search: params?.search,
        isActive: params?.isActive,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useGetPaymentMethodById(
  id: number,
  options?: {
    query?: Omit<UseQueryOptions<PaymentMethodDto, ApiError, PaymentMethodDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<PaymentMethodDto, ApiError, PaymentMethodDto, QueryKey>({
    queryKey: ["payment-method-details", id],
    enabled: !isNaN(id) && id > 0,
    queryFn: async () => {
      return apiGet<PaymentMethodDto>(`/PaymentMethods/${id}`);
    },
    ...options?.query,
  });
}

export function useCreatePaymentMethod(options?: {
  mutation?: UseMutationOptions<PaymentMethodDto | null, ApiError, { data: CreatePaymentMethodRequest }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<PaymentMethodDto>("/PaymentMethods", data);
    return response.data;
  }, options);
}

export function useUpdatePaymentMethod(options?: {
  mutation?: UseMutationOptions<PaymentMethodDto | null, ApiError, { data: UpdatePaymentMethodRequest }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPut<PaymentMethodDto>("/PaymentMethods", data);
    return response.data;
  }, options);
}

export function useDeletePaymentMethod(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/PaymentMethods/${id}`);
    return response.data;
  }, options);
}
