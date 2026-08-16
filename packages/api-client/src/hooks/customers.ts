/**
 * Clientes.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import {
  apiGetOrThrow,
  apiPost,
  apiPut,
  apiDelete,
  ApiError,
  useCrudMutation,
  mapPagedResult,
} from "../client";
import type {
  BackendPagedResult,
  CreateCustomerPayload,
  CustomerDto,
  CustomerSummaryDto,
  QueryKey,
  UiPagedResult,
  UpdateCustomerPayload,
} from "../models";

export const getGetCustomersQueryKey = (): QueryKey => ["customers"];

/**
 * Prefixo da listagem com consolidado de compras.
 *
 * Fica SOB `["customers"]` para que a invalidação de quem cadastra, edita ou
 * remove um cliente alcance as duas listagens de uma vez.
 */
export const getGetCustomerSummariesQueryKey = (): QueryKey => ["customers", "summary"];

export function useGetCustomers(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<CustomerDto>, ApiError, UiPagedResult<CustomerDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CustomerDto>, ApiError, UiPagedResult<CustomerDto>, QueryKey>({
    queryKey: [...getGetCustomersQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<CustomerDto>>("/Customers", {
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
 * Página de clientes com total comprado, número de compras e data da última —
 * tudo somado pelo banco.
 *
 * Antes disso a tela baixava a tabela de vendas INTEIRA (`fetchAllPages` em
 * `/Sales`, sem filtro) só para calcular esses três números das 15 linhas
 * visíveis. Os demais catálogos estabilizam em centenas de linhas; venda não
 * estabiliza nunca, e a varredura completa LANÇA ao passar de 20 mil itens — a
 * tela parava de abrir quando a loja crescia.
 *
 * @param params Busca (nome, email, telefone ou documento), página e linhas por página.
 */
export function useGetCustomerSummaries(
  params?: { search?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<
        UiPagedResult<CustomerSummaryDto>,
        ApiError,
        UiPagedResult<CustomerSummaryDto>,
        QueryKey
      >,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CustomerSummaryDto>, ApiError, UiPagedResult<CustomerSummaryDto>, QueryKey>({
    queryKey: [...getGetCustomerSummariesQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<CustomerSummaryDto>>("/Customers/summary", {
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
  mutation?: UseMutationOptions<null, ApiError, { data: CreateCustomerPayload }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<null>("/Customers", data);
    return response.data;
  }, options);
}

export function useUpdateCustomer(options?: {
  mutation?: UseMutationOptions<CustomerDto | null, ApiError, { id: number; data: UpdateCustomerPayload }>;
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
