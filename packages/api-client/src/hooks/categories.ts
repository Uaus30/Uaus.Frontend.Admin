/**
 * Categorias e departamentos.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 *
 * Os caminhos `/Categories` e `/Departments` moravam TAMBÉM em
 * `apps/admin/src/services/categories.service.ts`, que montava as mesmas
 * requisições à mão. Duas cópias do mesmo endereço é o começo da divergência
 * silenciosa descrita no CLAUDE.md — trocar `size` por `limit` num lado não
 * quebra compilação nenhuma, só devolve página errada. Agora existe um lugar
 * só; o arquivo do admin virou reexport.
 *
 * Cada endpoint aparece aqui em duas formas: a **função de acesso** (que carrega
 * o caminho e os parâmetros) e o **hook** (que carrega a chave de cache). O hook
 * chama a função — nunca refaz a requisição — para o caminho continuar escrito
 * uma vez só.
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
import type {
  BackendPagedResult,
  CategoryDto,
  CreateCategoryPayload,
  DepartmentDto,
  QueryKey,
  UiPagedResult,
  UpdateCategoryPayload,
} from "../models";

/**
 * Departamento não tem payload próprio em `models.ts` porque só ganhou escrita
 * quando a feature saiu do `services/`. Deriva do DTO pelo mesmo motivo dos
 * demais: campo novo no DTO aparece aqui sozinho.
 */
export type CreateDepartmentPayload = Pick<DepartmentDto, "name" | "description">;
export type UpdateDepartmentPayload = CreateDepartmentPayload;

/** Filtros da listagem paginada de categorias. */
export interface CategoriesPageParams {
  search?: string;
  departmentId?: number;
  page?: number;
  limit?: number;
}

/** Filtros da listagem paginada de departamentos. */
export interface DepartmentsPageParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const getGetCategoriesQueryKey = (): QueryKey => ["categories"];
export const getGetDepartmentsQueryKey = (): QueryKey => ["departments"];

/**
 * Uma página de categorias.
 *
 * O servidor chama o tamanho de página de `size`; a UI do admin chama de
 * `limit`. A tradução acontece aqui, e só aqui, para nenhuma tela precisar
 * saber o nome do parâmetro do backend.
 */
export async function getCategoriesPage(params?: CategoriesPageParams) {
  const result = await apiGetOrThrow<BackendPagedResult<CategoryDto>>("/Categories", {
    search: params?.search,
    departmentId: params?.departmentId,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
  return mapPagedResult(result);
}

/** Catálogo completo de categorias, varrendo todas as páginas. */
export async function getAllCategories(params?: { departmentId?: number }) {
  return fetchAllPages<CategoryDto>("/Categories", params);
}

/** Uma página de departamentos. */
export async function getDepartmentsPage(params?: DepartmentsPageParams) {
  const result = await apiGetOrThrow<BackendPagedResult<DepartmentDto>>("/Departments", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
  return mapPagedResult(result);
}

/** Catálogo completo de departamentos, varrendo todas as páginas. */
export async function getAllDepartments() {
  return fetchAllPages<DepartmentDto>("/Departments");
}

export function useGetCategories(
  params?: CategoriesPageParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<CategoryDto>, ApiError, UiPagedResult<CategoryDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CategoryDto>, ApiError, UiPagedResult<CategoryDto>, QueryKey>({
    queryKey: [...getGetCategoriesQueryKey(), params ?? {}],
    queryFn: () => getCategoriesPage(params),
    ...options?.query,
  });
}

export function useGetDepartments(
  params?: DepartmentsPageParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<DepartmentDto>, ApiError, UiPagedResult<DepartmentDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<DepartmentDto>, ApiError, UiPagedResult<DepartmentDto>, QueryKey>({
    queryKey: [...getGetDepartmentsQueryKey(), params ?? {}],
    queryFn: () => getDepartmentsPage(params),
    ...options?.query,
  });
}

export async function createCategory(data: CreateCategoryPayload) {
  const response = await apiPost<null>("/Categories", data);
  return response.data;
}

/** O backend recebe o id no CORPO do PUT, não na rota. */
export async function updateCategory(payload: UpdateCategoryPayload & { id: number }) {
  const response = await apiPut<CategoryDto>("/Categories", payload);
  return response.data;
}

export async function deleteCategory(id: number) {
  const response = await apiDelete<null>(`/Categories/${id}`);
  return response.data;
}

export async function createDepartment(data: CreateDepartmentPayload) {
  const response = await apiPost<null>("/Departments", data);
  return response.data;
}

export async function updateDepartment(payload: UpdateDepartmentPayload & { id: number }) {
  const response = await apiPut<DepartmentDto>("/Departments", payload);
  return response.data;
}

export async function deleteDepartment(id: number) {
  const response = await apiDelete<null>(`/Departments/${id}`);
  return response.data;
}

export function useCreateCategory(options?: {
  mutation?: UseMutationOptions<null, ApiError, { data: CreateCategoryPayload }>;
}) {
  return useCrudMutation(({ data }: { data: CreateCategoryPayload }) => createCategory(data), options);
}

export function useUpdateCategory(options?: {
  mutation?: UseMutationOptions<CategoryDto | null, ApiError, { id: number; data: UpdateCategoryPayload }>;
}) {
  return useCrudMutation(
    ({ id, data }: { id: number; data: UpdateCategoryPayload }) => updateCategory({ id, ...data }),
    options,
  );
}

export function useDeleteCategory(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(({ id }: { id: number }) => deleteCategory(id), options);
}
