/**
 * Cupons de desconto — cadastro do painel administrativo.
 *
 * Aqui se define **o que o panfleto promete**. Nada neste arquivo aplica cupom
 * em venda nem mexe no contador de uso: o consumo é um UPDATE condicional que
 * roda dentro da transação da venda, no servidor. A consulta do balcão também
 * não mora aqui — ela é `lookupPdvCoupon`, em `./pdv`, porque tem rota, papel
 * (`Admin,Seller`) e semântica próprios.
 *
 * Contrato em PLANO-CUPONS-CAMPANHAS.md e em `CouponsController` do backend.
 * Todas as rotas exigem o papel **Admin**.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  CouponDto,
  CouponReconciliationDto,
  QueryKey,
  SaveCouponPayload,
  UiPagedResult,
} from "../models";

/**
 * Chave de cache da listagem de cupons.
 *
 * Só o PREFIXO, como manda o README: quem consulta acrescenta os parâmetros em
 * `[...getGetCouponsQueryKey(), params ?? {}]`. Uma factory que embutisse os
 * parâmetros faria a invalidação produzir `["Coupons", undefined]`, que não casa
 * com a query registrada — compila, roda, e a listagem simplesmente não atualiza
 * depois de salvar.
 */
export const getGetCouponsQueryKey = (): QueryKey => ["Coupons"];

/** Filtros da listagem de cupons. */
export interface CouponFilters {
  /** Trecho do código ou da descrição. */
  search?: string;
  /** Só os cupons de uma campanha. */
  campaignId?: number;
  /**
   * Só os cupons com o INDICADOR de ativo ligado.
   *
   * Não é filtro de vigência: ativo e vigência são colunas separadas, e o cupom
   * vencido continua aparecendo — é assim que o administrador o encontra para
   * desativar. `false` (o padrão) não filtra nada; não significa "só inativos".
   */
  onlyActive?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Lista os cupons.
 *
 * Fica no `staleTime` padrão (`STALE_TIME.operacao`) de propósito: a linha
 * carrega `redeemedCount`/`remainingUses`, que mudam sozinhos a cada venda no
 * balcão. Tratar esta lista como catálogo de cinco minutos deixaria a tela
 * dizendo "restam 3 usos" de um cupom já esgotado.
 */
export function useGetCoupons(
  params?: CouponFilters,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<CouponDto>, ApiError, UiPagedResult<CouponDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CouponDto>, ApiError, UiPagedResult<CouponDto>, QueryKey>({
    queryKey: [...getGetCouponsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<CouponDto>>("/Coupons", {
        search: params?.search,
        campaignId: params?.campaignId,
        onlyActive: params?.onlyActive,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Chave de cache do cupom individual.
 *
 * Prefixo próprio, distinto do da listagem: invalidar `["Coupons"]` não pode
 * arrastar o detalhe junto por casamento parcial, e vice-versa.
 */
export const getGetCouponByIdQueryKey = (): QueryKey => ["CouponDetails"];

/**
 * Detalha um cupom.
 *
 * @param id Cupom; a query fica desabilitada enquanto for indefinido.
 */
export function useGetCouponById(
  id?: number,
  options?: {
    query?: Omit<UseQueryOptions<CouponDto, ApiError, CouponDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<CouponDto, ApiError, CouponDto, QueryKey>({
    queryKey: [...getGetCouponByIdQueryKey(), id ?? 0],
    enabled: !!id,
    queryFn: () => apiGetOrThrow<CouponDto>(`/Coupons/${id}`),
    ...options?.query,
  });
}

/**
 * Cria um cupom. O servidor normaliza o código (maiúsculas, sem espaços) e o
 * teto de uso (negativo vira 0, que significa ILIMITADO).
 *
 * @throws {ApiError} 400 quando o código já pertence a outro cupom vivo, o
 *   percentual passa de 100, o valor não é positivo ou a campanha não existe.
 * @returns O cupom criado, ou null se a resposta vier sem corpo.
 */
export async function createCoupon(data: SaveCouponPayload): Promise<CouponDto | null> {
  const response = await apiPost<CouponDto>("/Coupons", data);
  return response.data;
}

/**
 * Atualiza um cupom. Vendas passadas NUNCA são afetadas — cada resgate congela
 * código, descrição, tipo e valor.
 *
 * Duas recusas do servidor que a tela precisa saber traduzir:
 * - **trocar o código de um cupom já resgatado é recusado** (mataria todo
 *   panfleto em circulação, e quem apresentasse o papel ouviria "não
 *   encontrado" sem ninguém entender por quê);
 * - baixar o teto de uso abaixo do já resgatado **é permitido** — é o "encerrar
 *   agora", e o UPDATE condicional simplesmente para de aceitar.
 *
 * Alterar vigência, valor, tipo, teto ou o indicador de ativo de um cupom **com
 * resgates** grava log de negócio no servidor; a tela deve pedir confirmação
 * mostrando quantos resgates já existem.
 *
 * @throws {ApiError} 400 nas recusas acima; 404 quando o cupom não existe.
 */
export async function updateCoupon(
  id: number,
  data: SaveCouponPayload,
): Promise<CouponDto | null> {
  const response = await apiPut<CouponDto>(`/Coupons/${id}`, data);
  return response.data;
}

/**
 * Exclui logicamente um cupom.
 *
 * **Recusado quando existe qualquer resgate** — com uso, o caminho é desativar,
 * e a tela troca o botão. O histórico não pode perder a linha que sustenta o
 * relatório da campanha e o comprovante já impresso.
 *
 * @throws {ApiError} 400 quando o cupom já foi utilizado.
 */
export async function deleteCoupon(id: number): Promise<void> {
  await apiDelete<null>(`/Coupons/${id}`);
}

/**
 * Confere o contador de uso do cupom contra o livro-razão de resgates.
 *
 * É função pura, e não hook com cache, porque a pergunta é "está batendo AGORA?"
 * — uma resposta guardada em cache responderia sobre um instante que já passou,
 * que é exatamente o que não serve numa conferência.
 *
 * Só leitura: não corrige nada. Corrigir exige decidir qual dos dois lados está
 * certo, e isso não é decisão de endpoint.
 */
export async function reconcileCoupon(id: number): Promise<CouponReconciliationDto> {
  return apiGetOrThrow<CouponReconciliationDto>(`/Coupons/${id}/reconcile`);
}
