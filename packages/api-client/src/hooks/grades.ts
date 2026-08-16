/**
 * Grades de variação (Tamanho, Cor, Modelo, Estampa).
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 *
 * Os caminhos `/Grades`, `/Grades/category/{id}` e `/Grades/enums/grade-type`
 * também eram montados em `apps/admin/src/services/grades.service.ts`. Vieram
 * para cá pela regra da fronteira de dados, e a mudança expôs uma divergência
 * real de contrato — ver `getAllGrades`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiPut, apiDelete, ApiError, useCrudMutation } from "../client";
import type { EnumOptionDto, GradeDto, QueryKey } from "../models";

/**
 * Opção de grade no ENVIO — não confundir com `GradeOptionDto`, que é a leitura.
 *
 * Na leitura toda opção tem `id` e `gradeId`, porque já existe no banco. No
 * envio o `id` é opcional: opção nova ainda não tem um, e opção existente
 * precisa mandar o seu para o servidor atualizar em vez de recriar — recriar
 * apagaria o vínculo das variações de produto que apontam para ela.
 */
export interface SaveGradeOptionPayload {
  /** Ausente em opção nova; presente em opção que já existe. */
  id?: number;
  value: string;
  colorHex?: string | null;
  displayOrder: number;
}

/**
 * Corpo do POST /Grades.
 *
 * O `name` NÃO entra: o servidor o deriva do tipo e das categorias associadas.
 * Mandá-lo do cliente foi o que fez o tipo antigo (`SaveGradePayload`, derivado
 * de `GradeDto`) descrever um contrato que o backend não tem.
 */
export interface CreateGradePayload {
  /** Código do `GradeType` (1 Tamanho, 2 Cor, 3 Modelo, 4 Estampa). */
  type: number;
  categoryIds: number[];
  options: SaveGradeOptionPayload[];
}

/** Corpo do PUT /Grades. O id vai no CORPO, não na rota. */
export interface UpdateGradePayload extends CreateGradePayload {
  id: number;
}

export const getGetGradesQueryKey = (): QueryKey => ["grades"];
export const getGetGradeTypeOptionsQueryKey = (): QueryKey => ["grade-type-options"];

/**
 * Todas as grades.
 *
 * `GET /Grades` devolve uma LISTA CRUA, não uma página — é o único endpoint de
 * catálogo do sistema assim. O serviço antigo do admin chamava `fetchAllPages`
 * aqui, que lê `pagination.filteredItems` e espalha `items`: sobre um array
 * esses campos são `undefined`, e a varredura estourava em `[...undefined]`.
 * Quem pagava era o editor de produtos, que carrega o catálogo de grades por
 * este caminho. Não troque por `fetchAllPages` sem antes paginar o endpoint no
 * backend.
 */
export async function getAllGrades() {
  return apiGetOrThrow<GradeDto[]>("/Grades");
}

/** Grades associadas a uma categoria. Também devolve lista crua. */
export async function getGradesByCategoryId(categoryId: number) {
  return apiGetOrThrow<GradeDto[]>(`/Grades/category/${categoryId}`);
}

/** Catálogo de tipos de grade, derivado do enum do backend (`AllowAnonymous`). */
export async function getGradeTypeOptions() {
  return apiGetOrThrow<EnumOptionDto[]>("/Grades/enums/grade-type", undefined, { auth: false });
}

export function useGetGrades(options?: {
  query?: Omit<UseQueryOptions<GradeDto[], ApiError, GradeDto[], QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<GradeDto[], ApiError, GradeDto[], QueryKey>({
    queryKey: getGetGradesQueryKey(),
    queryFn: () => getAllGrades(),
    ...options?.query,
  });
}

export function useGetGradeTypeOptions(options?: {
  query?: Omit<UseQueryOptions<EnumOptionDto[], ApiError, EnumOptionDto[], QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<EnumOptionDto[], ApiError, EnumOptionDto[], QueryKey>({
    queryKey: getGetGradeTypeOptionsQueryKey(),
    queryFn: () => getGradeTypeOptions(),
    ...options?.query,
  });
}

export async function createGrade(data: CreateGradePayload) {
  const response = await apiPost<GradeDto>("/Grades", data);
  if (!response.data) {
    throw new ApiError("Não foi possível obter a grade criada.", 204, null, "POST", "/Grades");
  }
  return response.data;
}

export async function updateGrade(data: UpdateGradePayload) {
  const response = await apiPut<GradeDto>("/Grades", data);
  if (!response.data) {
    throw new ApiError("Não foi possível obter a grade atualizada.", 204, null, "PUT", "/Grades");
  }
  return response.data;
}

export async function deleteGrade(id: number) {
  const response = await apiDelete<null>(`/Grades/${id}`);
  return response.data;
}

export function useCreateGrade(options?: {
  mutation?: UseMutationOptions<GradeDto, ApiError, { data: CreateGradePayload }>;
}) {
  return useCrudMutation(({ data }: { data: CreateGradePayload }) => createGrade(data), options);
}

export function useUpdateGrade(options?: {
  mutation?: UseMutationOptions<GradeDto, ApiError, { data: UpdateGradePayload }>;
}) {
  return useCrudMutation(({ data }: { data: UpdateGradePayload }) => updateGrade(data), options);
}

export function useDeleteGrade(options?: { mutation?: UseMutationOptions<null, ApiError, { id: number }> }) {
  return useCrudMutation(({ id }: { id: number }) => deleteGrade(id), options);
}
