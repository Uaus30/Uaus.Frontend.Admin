/**
 * Logs do sistema.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
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
  requiresVerification: boolean;
  origin: string;
  message: string;
  details: string | null;
}

export const getGetLogsQueryKey = (): QueryKey => ["logs"];
export const getGetLogQueryKey = (): QueryKey => ["log-details"];

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
    queryKey: [...getGetLogQueryKey(), id],
    enabled: !isNaN(id) && id > 0,
    queryFn: async () => {
      return apiGetOrThrow<SystemLogDto>(`/Logs/${id}`);
    },
    ...options?.query,
  });
}

/**
 * Encerra a pendência humana de um log crítico.
 *
 * O endpoint é idempotente: repetir a chamada mantém o log verificado. O
 * backend não expõe uma atualização genérica para preservar mensagem e tipo,
 * que são dados imutáveis do evento original.
 */
export async function markLogAsVerified(id: number): Promise<SystemLogDto> {
  const response = await apiPut<SystemLogDto>(`/Logs/${id}/verification`);

  if (response.data == null) {
    throw new ApiError(
      `A resposta de /Logs/${id}/verification veio sem conteúdo.`,
      204,
      null,
      "PUT",
      `/Logs/${id}/verification`,
    );
  }

  return response.data;
}

export interface CreateLogPayload {
  /** 1=Information, 2=Alert, 3=Error, 4=Critical */
  type?: number | string;
  origin: string;
  message: string;
  details?: string | null;
}

/**
 * Cria um registro de log no backend.
 */
export async function createLog(payload: CreateLogPayload): Promise<SystemLogDto> {
  const response = await apiPost<SystemLogDto>("/Logs", payload);

  if (response.data == null) {
    throw new ApiError("A resposta de /Logs veio sem conteúdo.", 204, null, "POST", "/Logs");
  }

  return response.data;
}
