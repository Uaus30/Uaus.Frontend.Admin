/**
 * Faixa de compras do mês — verde, amarelo ou vermelho.
 *
 * Contrato em PLANO-FINANCEIRO.md (seções 2 e 6.1). A classificação mora no
 * domínio do backend; para simular uma compra ainda não gravada a tela usa
 * `purchaseBandFor`, do `@workspace/core`, contra as duas linhas daqui.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError } from "../client";
import type { PurchaseBudgetDto, QueryKey } from "../models";

/**
 * Chave de cache da faixa de compras.
 *
 * Quem a invalida: mutação de compra (registrar, editar, trocar a situação,
 * excluir, receber, cancelar o recebimento), mutação de aporte e fechamento
 * criado ou excluído — os três mexem em K, em A ou em S.
 */
export const getGetPurchaseBudgetQueryKey = (): QueryKey => ["PurchaseBudget"];

/**
 * A faixa de um mês, buscada direto, fora do cache.
 *
 * Existe para quem precisa do número na hora de uma mutação — o toast do aporte
 * diz "novembro passou de amarelo para verde", e para isso compara a faixa de
 * antes com a de depois.
 *
 * @param params `month` em `"yyyy-MM"`; sem ele, o servidor usa o mês corrente
 * no fuso da loja.
 */
export function getPurchaseBudget(params?: { month?: string }): Promise<PurchaseBudgetDto> {
  return apiGetOrThrow<PurchaseBudgetDto>("/PurchaseBudget", { month: params?.month });
}

/** A faixa de compras de um mês (S, A, V, C, K, F, as linhas, as folgas e o estoque a custo). */
export function useGetPurchaseBudget(
  params?: { month?: string },
  options?: {
    query?: Omit<
      UseQueryOptions<PurchaseBudgetDto, ApiError, PurchaseBudgetDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<PurchaseBudgetDto, ApiError, PurchaseBudgetDto, QueryKey>({
    queryKey: [...getGetPurchaseBudgetQueryKey(), params ?? {}],
    queryFn: () => getPurchaseBudget(params),
    ...options?.query,
  });
}
