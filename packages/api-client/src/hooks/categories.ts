/**
 * Categorias.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete, ApiError, useCrudMutation, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  CategoryDto,
  QueryKey,
  UiPagedResult,
} from "../models";

export const getGetCategoriesQueryKey = (): QueryKey => ["categories"];

export function useGetCategories(
  params?: { search?: string; departmentId?: number; page?: number; limit?: number },
  options?: {
    query?: Omit<UseQueryOptions<UiPagedResult<CategoryDto>, ApiError, UiPagedResult<CategoryDto>, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<UiPagedResult<CategoryDto>, ApiError, UiPagedResult<CategoryDto>, QueryKey>({
    queryKey: [...getGetCategoriesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGet<BackendPagedResult<CategoryDto>>("/Categories", {
        search: params?.search,
        departmentId: params?.departmentId,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

export function useCreateCategory(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<null>("/Categories", data);
    return response.data;
  }, options);
}

export function useUpdateCategory(options?: {
  mutation?: UseMutationOptions<CategoryDto | null, ApiError, { id: number; data: unknown }>;
}) {
  return useCrudMutation(async ({ id, data }) => {
    const response = await apiPut<CategoryDto>("/Categories", { id, ...(data as object) });
    return response.data;
  }, options);
}

export function useDeleteCategory(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Categories/${id}`);
    return response.data;
  }, options);
}
