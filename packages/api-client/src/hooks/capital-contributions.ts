/**
 * Aportes dos sócios — o dinheiro que entra como saldo disponível do mês.
 *
 * Contrato em PLANO-FINANCEIRO.md (seções 5.1 e 6.1). Aporte não é dívida da
 * loja com o sócio (decisão 9): não há saldo devedor nem devolução aqui.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError } from "../client";
import type {
  CapitalContributionDto,
  CapitalContributionPartnerTotalDto,
  CapitalContributionsMonthDto,
  QueryKey,
  SaveCapitalContributionPayload,
} from "../models";

/**
 * Quantos aportes a tela pede de uma vez. A resposta do mês não traz paginação
 * (só `items` e o `total` em reais), e um mês tem poucos aportes — pedir o teto
 * evita que a lista corte sem a tela saber. O total vem do servidor de qualquer
 * jeito, então ele nunca mente.
 */
const MONTH_PAGE_SIZE = 100;

/**
 * Chave de cache dos aportes — o PREFIXO do mês e do acumulado por sócio.
 *
 * Mutação de aporte invalida este prefixo e a faixa de compras
 * (`getGetPurchaseBudgetQueryKey`): o aporte entra como saldo disponível e muda
 * as duas linhas da faixa.
 */
export const getGetCapitalContributionsQueryKey = (): QueryKey => ["CapitalContributions"];

/** Chave do acumulado por sócio, debaixo do prefixo dos aportes. */
export const getGetCapitalContributionTotalsByPartnerQueryKey = (): QueryKey => [
  ...getGetCapitalContributionsQueryKey(),
  "totals-by-partner",
];

/**
 * Os aportes de um mês, com o total e se o mês já foi fechado.
 *
 * @param params `month` em `"yyyy-MM"`; sem ele, o servidor usa o mês corrente.
 */
export function useGetCapitalContributions(
  params?: { month?: string },
  options?: {
    query?: Omit<
      UseQueryOptions<CapitalContributionsMonthDto, ApiError, CapitalContributionsMonthDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<CapitalContributionsMonthDto, ApiError, CapitalContributionsMonthDto, QueryKey>({
    queryKey: [...getGetCapitalContributionsQueryKey(), params ?? {}],
    queryFn: () =>
      apiGetOrThrow<CapitalContributionsMonthDto>("/CapitalContributions", {
        month: params?.month,
        page: 1,
        size: MONTH_PAGE_SIZE,
      }),
    ...options?.query,
  });
}

/** O acumulado de cada sócio desde a abertura — informativo, não é saldo devedor. */
export function useGetCapitalContributionTotalsByPartner(options?: {
  query?: Omit<
    UseQueryOptions<
      CapitalContributionPartnerTotalDto[],
      ApiError,
      CapitalContributionPartnerTotalDto[],
      QueryKey
    >,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<
    CapitalContributionPartnerTotalDto[],
    ApiError,
    CapitalContributionPartnerTotalDto[],
    QueryKey
  >({
    queryKey: getGetCapitalContributionTotalsByPartnerQueryKey(),
    queryFn: () =>
      apiGetOrThrow<CapitalContributionPartnerTotalDto[]>("/CapitalContributions/totals-by-partner"),
    ...options?.query,
  });
}

/**
 * Lança um aporte.
 *
 * @throws {ApiError} Sócio ausente ou inativo, data ausente, valor ≤ 0 ou mês já
 * fechado — com a mensagem do backend.
 */
export async function createCapitalContribution(
  payload: SaveCapitalContributionPayload,
): Promise<CapitalContributionDto | null> {
  const response = await apiPost<CapitalContributionDto>("/CapitalContributions", payload);
  return response.data;
}

/** Altera um aporte. Mês fechado recusa — o do aporte e o da data nova. */
export async function updateCapitalContribution(
  id: number,
  payload: SaveCapitalContributionPayload,
): Promise<CapitalContributionDto | null> {
  const response = await apiPut<CapitalContributionDto>(`/CapitalContributions/${id}`, payload);
  return response.data;
}

/** Exclui um aporte (exclusão lógica, com Log de alerta). Mês fechado recusa. */
export async function deleteCapitalContribution(id: number): Promise<void> {
  await apiDelete<null>(`/CapitalContributions/${id}`);
}
