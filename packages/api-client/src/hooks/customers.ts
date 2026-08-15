/**
 * Clientes.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete, ApiError, useCrudMutation, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  CustomerDto,
  QueryKey,
  UiPagedResult,
} from "../models";

export const getGetCustomersQueryKey = (): QueryKey => ["customers"];

export function useGetCustomers(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<CustomerDto>, ApiError, UiPagedResult<CustomerDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<CustomerDto>, ApiError, UiPagedResult<CustomerDto>, QueryKey>({
    queryKey: [...getGetCustomersQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<CustomerDto>>("/Customers", {
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useCreateCustomer(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<null>("/Customers", data);
    return response.data;
  }, options);
}

export function useUpdateCustomer(options?: {
  mutation?: UseMutationOptions<CustomerDto | null, ApiError, { id: number; data: unknown }>;
}) {
  return useCrudMutation(async ({ id, data }) => {
    const response = await apiPut<CustomerDto>("/Customers", { id, ...(data as object) });
    return response.data;
  }, options);
}

export function useDeleteCustomer(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Customers/${id}`);
    return response.data;
  }, options);
}
