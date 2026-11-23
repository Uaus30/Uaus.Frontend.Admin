/**
 * Financeiro — custos fixos, sócios e o resumo financeiro.
 *
 * Fatia de `hooks.ts`, que tinha 1.755 linhas num arquivo só. Os fechamentos
 * moram em `financial-closings.ts`; aportes e faixa de compras, em
 * `capital-contributions.ts` e `purchase-budget.ts`. A superfície pública não
 * mudou: tudo continua saindo de `@workspace/api-client-react`.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  apiGetOrThrow,
  apiPost,
  apiPut,
  apiDelete,
  ApiError,
  mapPagedResult,
  extractCreatedId,
} from "../client";
import type {
  BackendPagedResult,
  CreatePartnerPayload,
  FinancialReportSummaryDto,
  FixedCostDto,
  PartnerDto,
  PartnerProfitSharesDto,
  QueryKey,
  SaveFixedCostPayload,
  UiPagedResult,
  UpdatePartnerPayload,
  UpdatePartnerProfitSharesPayload,
} from "../models";

// ---------------------------------------------------------------------------
// Financeiro — custos fixos, sócios e resumo
//
// Contrato do backend em Uaus.Backend.Api/docs/financeiro.md.
// ---------------------------------------------------------------------------

/** Chave de cache da listagem de custos fixos. */
export const getGetFixedCostsQueryKey = (): QueryKey => ["FixedCosts"];

/**
 * Lista os custos fixos.
 *
 * @param params `activeInMonth` ("yyyy-MM-01") filtra os vigentes naquele mês.
 */
export function useGetFixedCosts(
  params?: { search?: string; activeInMonth?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<FixedCostDto>, ApiError, UiPagedResult<FixedCostDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<FixedCostDto>, ApiError, UiPagedResult<FixedCostDto>, QueryKey>({
    queryKey: [...getGetFixedCostsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<FixedCostDto>>("/FixedCosts", {
        search: params?.search,
        activeInMonth: params?.activeInMonth,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Cria um custo fixo.
 *
 * @returns O ID criado (do header Location) ou null se o header não vier.
 */
export async function createFixedCost(data: SaveFixedCostPayload): Promise<number | null> {
  const response = await apiPost<FixedCostDto>("/FixedCosts", data);
  return extractCreatedId(response.response);
}

/** Atualiza um custo fixo. "Encerrar" um custo = preencher `endsOn` (hard delete só para lançado errado). */
export async function updateFixedCost(id: number, data: SaveFixedCostPayload): Promise<FixedCostDto | null> {
  const response = await apiPut<FixedCostDto>(`/FixedCosts/${id}`, data);
  return response.data;
}

/**
 * Exclui um custo fixo de vez. Fechamentos existentes não mudam: eles congelam
 * os totais na confirmação e não dependem desta linha.
 */
export async function deleteFixedCost(id: number): Promise<void> {
  await apiDelete<null>(`/FixedCosts/${id}`);
}

/** Chave de cache da listagem de sócios. */
export const getGetPartnersQueryKey = (): QueryKey => ["Partners"];

/** Lista os sócios (a API devolve todos; a UI decide filtrar inativos). */
export function useGetPartners(
  params?: { includeInactive?: boolean; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<PartnerDto>, ApiError, UiPagedResult<PartnerDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<PartnerDto>, ApiError, UiPagedResult<PartnerDto>, QueryKey>({
    queryKey: [...getGetPartnersQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<PartnerDto>>("/Partners", {
        includeInactive: params?.includeInactive,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Chave de cache da distribuição de lucros entre os sócios. */
export const PARTNER_PROFIT_SHARES_QUERY_KEY = ["partner-profit-shares"] as const;

/** Distribuição de lucros vigente (percentual de cada sócio e a soma). */
export function useGetPartnerProfitShares(options?: {
  query?: Omit<
    UseQueryOptions<PartnerProfitSharesDto, ApiError, PartnerProfitSharesDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<PartnerProfitSharesDto, ApiError, PartnerProfitSharesDto, QueryKey>({
    queryKey: PARTNER_PROFIT_SHARES_QUERY_KEY,
    queryFn: () => apiGetOrThrow<PartnerProfitSharesDto>("/Partners/profit-shares"),
    ...options?.query,
  });
}

/**
 * Cria um sócio — nasce ativo, com percentual 0 (ajuste na distribuição de lucros).
 *
 * @returns O ID criado (do header Location) ou null se o header não vier.
 */
export async function createPartner(data: CreatePartnerPayload): Promise<number | null> {
  const response = await apiPost<PartnerDto>("/Partners", data);
  return extractCreatedId(response.response);
}

/** Atualiza um sócio. Desativar zera o percentual — rebalanceie antes do próximo fechamento. */
export async function updatePartner(id: number, data: UpdatePartnerPayload): Promise<PartnerDto | null> {
  const response = await apiPut<PartnerDto>(`/Partners/${id}`, data);
  return response.data;
}

/**
 * Exclui um sócio.
 *
 * @throws {ApiError} Quando o sócio aparece no rateio de algum fechamento —
 * nesse caso o caminho certo é desativá-lo.
 */
export async function deletePartner(id: number): Promise<void> {
  await apiDelete<null>(`/Partners/${id}`);
}

/**
 * Grava os novos percentuais da distribuição de lucros.
 * Deve conter EXATAMENTE todos os sócios ativos e somar 100,00.
 *
 * Fechamentos existentes não mudam: o rateio deles foi congelado na confirmação.
 */
export async function updatePartnerProfitShares(
  data: UpdatePartnerProfitSharesPayload,
): Promise<PartnerProfitSharesDto | null> {
  const response = await apiPut<PartnerProfitSharesDto>("/Partners/profit-shares", data);
  return response.data;
}

/** Chave de cache do relatório financeiro do período. */
export const getFinancialReportSummaryQueryKey = (): QueryKey => ["financial-report-summary"];

/**
 * Relatório financeiro do período — prévia calculada ao vivo, nada é persistido.
 *
 * @param params Datas opcionais (o backend assume os últimos 30 dias).
 */
export function useGetFinancialReportSummary(
  params?: { startDate?: string; endDate?: string },
  options?: {
    query?: Omit<
      UseQueryOptions<FinancialReportSummaryDto, ApiError, FinancialReportSummaryDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<FinancialReportSummaryDto, ApiError, FinancialReportSummaryDto, QueryKey>({
    queryKey: [...getFinancialReportSummaryQueryKey(), params ?? {}],
    queryFn: () =>
      apiGetOrThrow<FinancialReportSummaryDto>("/FinancialReports/summary", {
        startDate: params?.startDate,
        endDate: params?.endDate,
      }),
    ...options?.query,
  });
}
