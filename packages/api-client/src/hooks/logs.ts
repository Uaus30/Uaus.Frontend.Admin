/**
 * Logs do sistema.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, QueryKey, UiPagedResult } from "../models";

// ==========================================
// SYSTEM LOGS TYPES & HOOKS
// ==========================================

export interface SystemLogDto {
  id: number;
  createdAt: string;
  updatedAt: string | null;
  code: string;
  requestId: string | null;
  /**
   * O backend atual serializa o enum como nome, mas versões já publicadas
   * também devolveram seu valor numérico. Manter as duas formas no contrato
   * impede que uma divergência de deploy derrube a tela inteira.
   */
  type: string | number;
  origin: string;
  message: string;
  details: string | null;
}

export const getGetLogsQueryKey = (): QueryKey => ["logs"];

export function useGetLogs(
  params?: {
    search?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<SystemLogDto>, ApiError, UiPagedResult<SystemLogDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<SystemLogDto>, ApiError, UiPagedResult<SystemLogDto>, QueryKey>({
    queryKey: [...getGetLogsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<SystemLogDto>>("/Logs", {
        search: params?.search,
        type: params?.type,
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

export function useGetLog(
  id: number,
  options?: {
    query?: Omit<UseQueryOptions<SystemLogDto, ApiError, SystemLogDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<SystemLogDto, ApiError, SystemLogDto, QueryKey>({
    queryKey: ["log-details", id],
    enabled: !isNaN(id) && id > 0,
    queryFn: async () => {
      return apiGetOrThrow<SystemLogDto>(`/Logs/${id}`);
    },
    ...options?.query,
  });
}
