/**
 * Sessões de caixa — abertura, fechamento e sessão corrente.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. A superfície
 * pública não mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, ApiError, apiRequest, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  CashRegisterSessionDto,
  QueryKey,
  SaleDto,
  UiPagedResult,
} from "../models";


// Cash Register Sessions Hooks

/** Chave de cache da listagem de sessões de caixa. */
export const getGetCashRegisterSessionsQueryKey = (): QueryKey => ["CashRegisterSessions"];

/** Chave de cache da sessão de caixa aberta do operador. */
export const CURRENT_CASH_REGISTER_SESSION_QUERY_KEY = ["cash-register-session-current"] as const;

/**
 * Lista as sessões de caixa, das mais recentes para as mais antigas.
 *
 * @param params Filtros por operador, status, período e paginação.
 */
export function useGetCashRegisterSessions(
  params?: { userId?: number; status?: number; startDate?: string; endDate?: string; page?: number; size?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<CashRegisterSessionDto>, ApiError, UiPagedResult<CashRegisterSessionDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CashRegisterSessionDto>, ApiError, UiPagedResult<CashRegisterSessionDto>, QueryKey>({
    queryKey: [...getGetCashRegisterSessionsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<CashRegisterSessionDto>>("/CashRegisterSessions", {
        userId: params?.userId,
        status: params?.status,
        startDate: params?.startDate,
        endDate: params?.endDate,
        page: params?.page ?? 1,
        size: params?.size ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Sessão de caixa aberta do operador autenticado.
 * Retorna null quando o caixa está fechado (a API responde 204).
 */
export function useGetCurrentCashRegisterSession(options?: {
  query?: Omit<
    UseQueryOptions<CashRegisterSessionDto | null, ApiError, CashRegisterSessionDto | null, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<CashRegisterSessionDto | null, ApiError, CashRegisterSessionDto | null, QueryKey>({
    queryKey: CURRENT_CASH_REGISTER_SESSION_QUERY_KEY,
    queryFn: async () => {
      const result = await apiRequest<CashRegisterSessionDto>("GET", "/CashRegisterSessions/current");
      return result.data ?? null;
    },
    ...options?.query,
  });
}

/**
 * Detalha uma sessão de caixa com o resumo consolidado das vendas.
 *
 * @param id ID da sessão; a query fica desabilitada enquanto for indefinido.
 */
export function useGetCashRegisterSessionById(
  id?: number,
  options?: {
    query?: Omit<UseQueryOptions<CashRegisterSessionDto, ApiError, CashRegisterSessionDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<CashRegisterSessionDto, ApiError, CashRegisterSessionDto, QueryKey>({
    queryKey: ["cash-register-session-details", id ?? 0],
    enabled: !!id,
    queryFn: async () => apiGetOrThrow<CashRegisterSessionDto>(`/CashRegisterSessions/${id}`),
    ...options?.query,
  });
}

/**
 * Abre o caixa do operador autenticado.
 *
 * @param data Fundo de troco colocado na gaveta e observações da abertura.
 * @returns A sessão recém-aberta.
 */
export async function openCashRegisterSession(data: { openingBalance: number; openingNotes?: string | null }) {
  const response = await apiPost<CashRegisterSessionDto>("/CashRegisterSessions/open", data);
  return response.data;
}

/**
 * Fecha o caixa conferindo o dinheiro em gaveta contra o valor esperado
 * (fundo de troco somado ao recebido em espécie).
 *
 * @param id ID da sessão aberta.
 * @param data Valor contado na gaveta e observações do fechamento.
 * @returns A sessão fechada, já com contado, esperado e diferença.
 */
export async function closeCashRegisterSession(
  id: number,
  data: { countedAmount: number; closingNotes?: string | null },
) {
  const response = await apiPost<CashRegisterSessionDto>(`/CashRegisterSessions/${id}/close`, data);
  return response.data;
}

/**
 * Cancela a venda devolvendo ao estoque os lotes consumidos pelos itens.
 * A venda continua existindo, marcada como cancelada, para preservar o histórico.
 *
 * @param id ID da venda.
 * @param reason Motivo do cancelamento, anexado à observação da venda.
 * @returns A venda já cancelada.
 */
export async function cancelSale(id: number, reason?: string | null) {
  const response = await apiPost<SaleDto>(`/Sales/${id}/cancel`, { reason: reason ?? null });
  return response.data;
}
