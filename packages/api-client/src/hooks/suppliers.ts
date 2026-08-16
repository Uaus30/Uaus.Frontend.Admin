/**
 * Fornecedores.
 *
 * O caminho `/Suppliers` morava em `apps/admin/src/services/suppliers.service.ts`,
 * e o caminho do enum de status estava solto em `services/core.ts` como string
 * passada de parâmetro. Os dois vieram para cá pela regra da fronteira de dados.
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
  fetchAllPages,
} from "../client";
import type { BackendPagedResult, EnumOptionDto, QueryKey, SupplierDto, UiPagedResult } from "../models";

export type CreateSupplierPayload = Omit<SupplierDto, "id" | "createdAt" | "updatedAt">;
export type UpdateSupplierPayload = CreateSupplierPayload;

/** Filtros da listagem paginada de fornecedores. */
export interface SuppliersPageParams {
  search?: string;
  /**
   * Código do status. Vai ao SERVIDOR de propósito.
   *
   * Filtrar depois, sobre a página já recortada, mostrava só os inativos que por
   * acaso caíram nos 20 itens da página corrente — e o contador de páginas
   * continuava contando todos, produzindo páginas vazias no fim da lista.
   */
  status?: number;
  page?: number;
  limit?: number;
}

export const getGetSuppliersQueryKey = (): QueryKey => ["suppliers"];
export const getGetSupplierStatusOptionsQueryKey = (): QueryKey => ["supplier-status-options"];

/** Uma página de fornecedores. `limit` é o nome da UI; o servidor espera `size`. */
export async function getSuppliersPage(params?: SuppliersPageParams) {
  const result = await apiGetOrThrow<BackendPagedResult<SupplierDto>>("/Suppliers", {
    search: params?.search,
    status: params?.status,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
  return mapPagedResult(result);
}

/** Catálogo completo de fornecedores, varrendo todas as páginas. */
export async function getAllSuppliers() {
  return fetchAllPages<SupplierDto>("/Suppliers");
}

/**
 * Catálogo de status de fornecedor, derivado do enum do backend.
 *
 * Vai sem token (`auth: false`) porque o endpoint é `AllowAnonymous` — e porque
 * a tela precisa das opções para montar o formulário antes mesmo de qualquer
 * consulta autenticada responder.
 */
export async function getSupplierStatusOptions() {
  return apiGetOrThrow<EnumOptionDto[]>("/Suppliers/enums/supplier-status", undefined, { auth: false });
}

export function useGetSuppliers(
  params?: SuppliersPageParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<SupplierDto>, ApiError, UiPagedResult<SupplierDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<SupplierDto>, ApiError, UiPagedResult<SupplierDto>, QueryKey>({
    queryKey: [...getGetSuppliersQueryKey(), params ?? {}],
    queryFn: () => getSuppliersPage(params),
    ...options?.query,
  });
}

export function useGetSupplierStatusOptions(options?: {
  query?: Omit<UseQueryOptions<EnumOptionDto[], ApiError, EnumOptionDto[], QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<EnumOptionDto[], ApiError, EnumOptionDto[], QueryKey>({
    queryKey: getGetSupplierStatusOptionsQueryKey(),
    queryFn: () => getSupplierStatusOptions(),
    ...options?.query,
  });
}

export async function createSupplier(data: CreateSupplierPayload) {
  const response = await apiPost<null>("/Suppliers", data);
  return response.data;
}

/** O backend recebe o id no CORPO do PUT, não na rota. */
export async function updateSupplier(payload: UpdateSupplierPayload & { id: number }) {
  const response = await apiPut<SupplierDto>("/Suppliers", payload);
  return response.data;
}

export async function deleteSupplier(id: number) {
  const response = await apiDelete<null>(`/Suppliers/${id}`);
  return response.data;
}

export function useCreateSupplier(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: CreateSupplierPayload }>;
}) {
  return useCrudMutation(({ data }: { data: CreateSupplierPayload }) => createSupplier(data), options);
}

export function useUpdateSupplier(options?: {
  mutation?: UseMutationOptions<SupplierDto | null, ApiError, { id: number; data: UpdateSupplierPayload }>;
}) {
  return useCrudMutation(
    ({ id, data }: { id: number; data: UpdateSupplierPayload }) => updateSupplier({ id, ...data }),
    options,
  );
}

export function useDeleteSupplier(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(({ id }: { id: number }) => deleteSupplier(id), options);
}
