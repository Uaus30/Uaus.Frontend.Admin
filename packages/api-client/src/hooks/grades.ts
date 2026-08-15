/**
 * Grades de variação.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiPut, apiDelete, ApiError, useCrudMutation } from "../client";
import type {
  GradeDto,
  QueryKey,
} from "../models";

export const getGetGradesQueryKey = (): QueryKey => ["grades"];

export function useGetGrades(options?: {
  query?: Omit<UseQueryOptions<GradeDto[], ApiError, GradeDto[], QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<GradeDto[], ApiError, GradeDto[], QueryKey>({
    queryKey: getGetGradesQueryKey(),
    queryFn: async () => {
      return apiGetOrThrow<GradeDto[]>("/Grades");
    },
    ...options?.query,
  });
}

export function useCreateGrade(options?: {
  mutation?: UseMutationOptions<GradeDto, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPost<GradeDto>("/Grades", data);
    if (!response.data) throw new Error("Não foi possível obter a grade criada.");
    return response.data;
  }, options);
}

export function useUpdateGrade(options?: {
  mutation?: UseMutationOptions<GradeDto, ApiError, { data: unknown }>;
}) {
  return useCrudMutation(async ({ data }) => {
    const response = await apiPut<GradeDto>("/Grades", data);
    if (!response.data) throw new Error("Não foi possível obter a grade atualizada.");
    return response.data;
  }, options);
}

export function useDeleteGrade(options?: {
  mutation?: UseMutationOptions<null, ApiError, { id: number }>;
}) {
  return useCrudMutation(async ({ id }) => {
    const response = await apiDelete<null>(`/Grades/${id}`);
    return response.data;
  }, options);
}
