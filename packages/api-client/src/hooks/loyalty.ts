/**
 * Programa de fidelidade (01/10/2026) — configuração, ligar e desligar, o
 * cartão do cliente que o caixa consulta, o extrato e os números do painel.
 *
 * Contrato em `LoyaltyController` do backend (`/Loyalty`).
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiPut, ApiError } from "../client";
import type {
  AdjustLoyaltyStampsPayload,
  CustomerLoyaltyDto,
  LoyaltyActionCountsDto,
  LoyaltyActionList,
  LoyaltyActionRowDto,
  LoyaltyChartsDto,
  LoyaltyRewardStatusFilter,
  LoyaltySaleOutcomeDto,
  LoyaltySettingsDto,
  LoyaltyStatementDto,
  LoyaltySummaryDto,
  QueryKey,
  UpdateLoyaltySettingsPayload,
} from "../models";

/** Prefixo da configuração; ligar, desligar e salvar invalidam por ele. */
export const getLoyaltySettingsQueryKey = (): QueryKey => ["LoyaltySettings"];

/** Prefixo dos números do painel; quem consulta acrescenta o período. */
export const getLoyaltySummaryQueryKey = (): QueryKey => ["LoyaltySummary"];

/** Prefixo do cartão de um cliente; quem consulta acrescenta o ID. */
export const getCustomerLoyaltyQueryKey = (): QueryKey => ["CustomerLoyalty"];

/** Prefixo do extrato de um cliente; quem consulta acrescenta o ID. */
export const getLoyaltyStatementQueryKey = (): QueryKey => ["LoyaltyStatement"];

type QueryOptions<T> = Omit<UseQueryOptions<T, ApiError, T, QueryKey>, "queryKey" | "queryFn">;

export function useGetLoyaltySettings(options?: { query?: QueryOptions<LoyaltySettingsDto> }) {
  return useQuery<LoyaltySettingsDto, ApiError, LoyaltySettingsDto, QueryKey>({
    queryKey: getLoyaltySettingsQueryKey(),
    queryFn: () => apiGetOrThrow<LoyaltySettingsDto>("/Loyalty/settings"),
    ...options?.query,
  });
}

/** Grava a regra. Com o programa ligado, o servidor recusa cupom que não serve. */
export async function updateLoyaltySettings(
  data: UpdateLoyaltySettingsPayload,
): Promise<LoyaltySettingsDto | null> {
  return (await apiPut<LoyaltySettingsDto>("/Loyalty/settings", data)).data;
}

/** Liga o programa. Recusado (400) com a lista do que falta, se algo impedir. */
export async function turnOnLoyalty(): Promise<LoyaltySettingsDto | null> {
  return (await apiPost<LoyaltySettingsDto>("/Loyalty/settings/turn-on", {})).data;
}

/** Desliga: as vendas deixam de carimbar e o prêmio deixa de entrar sozinho. */
export async function turnOffLoyalty(): Promise<LoyaltySettingsDto | null> {
  return (await apiPost<LoyaltySettingsDto>("/Loyalty/settings/turn-off", {})).data;
}

/** Período do painel em datas da loja (`yyyy-MM-dd`, inclusivas). Sem datas, todo o histórico. */
export interface LoyaltyPeriod {
  from?: string;
  to?: string;
}

export function useGetLoyaltySummary(
  period: LoyaltyPeriod,
  options?: { query?: QueryOptions<LoyaltySummaryDto> },
) {
  return useQuery<LoyaltySummaryDto, ApiError, LoyaltySummaryDto, QueryKey>({
    queryKey: [...getLoyaltySummaryQueryKey(), period.from ?? "", period.to ?? ""],
    queryFn: () => apiGetOrThrow<LoyaltySummaryDto>("/Loyalty/summary", { from: period.from, to: period.to }),
    ...options?.query,
  });
}

/** O cartão do cliente, como o caixa precisa dele ao identificá-lo. */
export function getCustomerLoyalty(customerId: number): Promise<CustomerLoyaltyDto> {
  return apiGetOrThrow<CustomerLoyaltyDto>(`/Loyalty/customers/${customerId}`);
}

export function useGetCustomerLoyalty(
  customerId?: number | null,
  options?: { query?: QueryOptions<CustomerLoyaltyDto> },
) {
  return useQuery<CustomerLoyaltyDto, ApiError, CustomerLoyaltyDto, QueryKey>({
    queryKey: [...getCustomerLoyaltyQueryKey(), customerId ?? 0],
    enabled: !!customerId,
    queryFn: () => getCustomerLoyalty(customerId as number),
    ...options?.query,
  });
}

/** A segunda via do cartão: cada carimbo com a data, e os prêmios. */
export function getLoyaltyStatement(customerId: number): Promise<LoyaltyStatementDto> {
  return apiGetOrThrow<LoyaltyStatementDto>(`/Loyalty/customers/${customerId}/statement`);
}

export function useGetLoyaltyStatement(
  customerId?: number | null,
  options?: { query?: QueryOptions<LoyaltyStatementDto> },
) {
  return useQuery<LoyaltyStatementDto, ApiError, LoyaltyStatementDto, QueryKey>({
    queryKey: [...getLoyaltyStatementQueryKey(), customerId ?? 0],
    enabled: !!customerId,
    queryFn: () => getLoyaltyStatement(customerId as number),
    ...options?.query,
  });
}

/** Prefixo dos gráficos e do "Para agir"; o ajuste manual invalida por ele. */
export const getLoyaltyDashboardQueryKey = (): QueryKey => ["LoyaltyDashboard"];

export function useGetLoyaltyCharts(
  period: LoyaltyPeriod,
  options?: { query?: QueryOptions<LoyaltyChartsDto> },
) {
  return useQuery<LoyaltyChartsDto, ApiError, LoyaltyChartsDto, QueryKey>({
    queryKey: [...getLoyaltyDashboardQueryKey(), "charts", period.from ?? "", period.to ?? ""],
    queryFn: () => apiGetOrThrow<LoyaltyChartsDto>("/Loyalty/charts", { from: period.from, to: period.to }),
    ...options?.query,
  });
}

export function useGetLoyaltyActionCounts(options?: { query?: QueryOptions<LoyaltyActionCountsDto> }) {
  return useQuery<LoyaltyActionCountsDto, ApiError, LoyaltyActionCountsDto, QueryKey>({
    queryKey: [...getLoyaltyDashboardQueryKey(), "actions"],
    queryFn: () => apiGetOrThrow<LoyaltyActionCountsDto>("/Loyalty/actions"),
    ...options?.query,
  });
}

/**
 * Os clientes de uma lista do "Para agir". `status` filtra a lista de prêmios
 * esperando troca (sem ele, os disponíveis); as outras listas o ignoram.
 */
export function useGetLoyaltyActionList(
  list: LoyaltyActionList | null,
  status?: LoyaltyRewardStatusFilter,
  options?: { query?: QueryOptions<LoyaltyActionRowDto[]> },
) {
  return useQuery<LoyaltyActionRowDto[], ApiError, LoyaltyActionRowDto[], QueryKey>({
    queryKey: [...getLoyaltyDashboardQueryKey(), "actions", list ?? "", status ?? ""],
    enabled: list !== null,
    queryFn: () => apiGetOrThrow<LoyaltyActionRowDto[]>(`/Loyalty/actions/${list}`, { status }),
    ...options?.query,
  });
}

/** Ajuste manual de carimbos, com motivo. Devolve o cartão como ficou. */
export async function adjustLoyaltyStamps(
  customerId: number,
  data: AdjustLoyaltyStampsPayload,
): Promise<LoyaltySaleOutcomeDto | null> {
  return (await apiPost<LoyaltySaleOutcomeDto>(`/Loyalty/customers/${customerId}/adjustments`, data)).data;
}
