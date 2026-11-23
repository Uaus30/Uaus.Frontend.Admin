/**
 * Fechamentos mensais — listagem, detalhe, prévia, confirmação, exclusão e o
 * mês que aguarda fechamento.
 *
 * Saiu de `financial.ts` (23/11/2026) quando a corrente de saldos trouxe o
 * `next` e o arquivo ia passar das 300 linhas. A superfície pública não mudou:
 * tudo continua saindo de `@workspace/api-client-react`.
 *
 * Contrato em PLANO-FINANCEIRO.md (seção 6.1) e Uaus.Backend.Api/docs/financeiro.md.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, apiDelete, ApiError, mapPagedResult, extractCreatedId } from "../client";
import type {
  BackendPagedResult,
  CreateFinancialClosingPayload,
  FinancialClosingDto,
  FinancialClosingNextDto,
  FinancialClosingPreviewDto,
  PreviewFinancialClosingPayload,
  QueryKey,
  UiPagedResult,
} from "../models";

/**
 * Chave de cache dos fechamentos — o PREFIXO da listagem e do `next`.
 *
 * Fechamento criado ou excluído invalida este prefixo (que alcança o `next`),
 * a faixa de compras (`getGetPurchaseBudgetQueryKey`) e os aportes
 * (`getGetCapitalContributionsQueryKey`): o saldo confirmado abre o mês
 * seguinte, e o mês fechado deixa de aceitar aporte.
 */
export const getGetFinancialClosingsQueryKey = (): QueryKey => ["FinancialClosings"];

/** Lista os fechamentos (filtro sobre o início do período; mais recentes primeiro). */
export function useGetFinancialClosings(
  params?: { startDate?: string; endDate?: string; page?: number; limit?: number },
  options?: {
    query?: Omit<
      UseQueryOptions<
        UiPagedResult<FinancialClosingDto>,
        ApiError,
        UiPagedResult<FinancialClosingDto>,
        QueryKey
      >,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<FinancialClosingDto>, ApiError, UiPagedResult<FinancialClosingDto>, QueryKey>(
    {
      queryKey: [...getGetFinancialClosingsQueryKey(), params ?? {}],
      queryFn: async () => {
        const result = await apiGetOrThrow<BackendPagedResult<FinancialClosingDto>>("/FinancialClosings", {
          startDate: params?.startDate,
          endDate: params?.endDate,
          page: params?.page ?? 1,
          size: params?.limit ?? 20,
        });
        return mapPagedResult(result);
      },
      ...options?.query,
    },
  );
}

/**
 * Prefixo da chave do detalhe de um fechamento: `["FinancialClosings", "detail"]`
 * — quem consulta acrescenta o id, como manda a convenção das chaves.
 *
 * Fica debaixo do prefixo da listagem porque o detalhe traz o `isLatest`, e ele
 * muda quando OUTRO fechamento é criado ou excluído. Com a chave antiga
 * (`["financial-closing-details", id]`), o detalhe já em cache do anterior
 * continuava sem o botão Excluir depois de excluir o último, até recarregar a
 * página (smoke de 23/11/2026). Invalidar os fechamentos agora alcança os
 * detalhes.
 */
export const getGetFinancialClosingByIdQueryKey = (): QueryKey => [
  ...getGetFinancialClosingsQueryKey(),
  "detail",
];

/**
 * Detalha um fechamento com o rateio congelado por sócio.
 *
 * @param id ID do fechamento; a query fica desabilitada enquanto for indefinido.
 */
export function useGetFinancialClosingById(
  id?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<FinancialClosingDto, ApiError, FinancialClosingDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<FinancialClosingDto, ApiError, FinancialClosingDto, QueryKey>({
    queryKey: [...getGetFinancialClosingByIdQueryKey(), id ?? 0],
    enabled: !!id,
    queryFn: async () => apiGetOrThrow<FinancialClosingDto>(`/FinancialClosings/${id}`),
    ...options?.query,
  });
}

/**
 * Chave do mês que aguarda fechamento: `["FinancialClosings", "next"]`, debaixo
 * do prefixo da listagem — invalidar os fechamentos já a alcança.
 */
export const getGetFinancialClosingNextQueryKey = (): QueryKey => [
  ...getGetFinancialClosingsQueryKey(),
  "next",
];

/**
 * O mês que aguarda fechamento e se ele é a implantação do fluxo novo.
 *
 * É ele que o diálogo de novo fechamento sugere: com a corrente de saldos, só
 * se fecha M com M−1 fechado no fluxo novo (a exceção é a implantação).
 */
export function useGetFinancialClosingNext(options?: {
  query?: Omit<
    UseQueryOptions<FinancialClosingNextDto, ApiError, FinancialClosingNextDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<FinancialClosingNextDto, ApiError, FinancialClosingNextDto, QueryKey>({
    queryKey: getGetFinancialClosingNextQueryKey(),
    queryFn: () => apiGetOrThrow<FinancialClosingNextDto>("/FinancialClosings/next"),
    ...options?.query,
  });
}

/**
 * Calcula a prévia de um fechamento SEM persistir nada.
 * Soma de percentuais ≠ 100, período parcial de mês, retirada acima do lucro e
 * saldo negativo viram warnings — a prévia só avisa.
 */
export async function previewFinancialClosing(
  data: PreviewFinancialClosingPayload,
): Promise<FinancialClosingPreviewDto | null> {
  const response = await apiPost<FinancialClosingPreviewDto>("/FinancialClosings/preview", data);
  return response.data;
}

/**
 * Confirma o fechamento: o servidor RECALCULA tudo e congela números e rateio.
 *
 * @throws {ApiError} Período que não começa depois do último fechamento, mês
 * anterior sem fechamento no fluxo novo (fora da implantação), saldo confirmado
 * ausente, diferença acima de R$ 1,00 sem observação ou soma dos percentuais ≠ 100.
 * @returns O ID criado (do header Location) ou null se o header não vier.
 */
export async function createFinancialClosing(data: CreateFinancialClosingPayload): Promise<number | null> {
  const response = await apiPost<FinancialClosingDto>("/FinancialClosings", data);
  return extractCreatedId(response.response);
}

/**
 * Exclui um fechamento para permitir refazê-lo. Só o ÚLTIMO pode sair: os
 * outros voltam 400 dizendo qual excluir antes. Ação destrutiva de documento —
 * o backend registra em log quem excluiu.
 */
export async function deleteFinancialClosing(id: number): Promise<void> {
  await apiDelete<null>(`/FinancialClosings/${id}`);
}
