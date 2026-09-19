/**
 * Promoções de preço — cadastro do painel administrativo.
 *
 * Aqui se define **o que vale, para quem e quando**. Nada neste arquivo aplica
 * promoção em venda nem escreve preço em produto: o preço promocional é DERIVADO
 * da promoção a cada leitura, e quem o aplica no balcão é o PDV, a partir da base
 * local (fase 1b).
 *
 * Contrato em PLANO-PROMOCOES.md e em `PromotionsController` do backend. Todas as
 * rotas exigem o papel **Admin** — a tela expõe custo e margem item a item.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  PromotionDetailsDto,
  PromotionDiscountTypeCode,
  PromotionDto,
  PromotionPerformanceDto,
  PromotionPreviewDto,
  PromotionTypeCode,
  QueryKey,
  SavePromotionPayload,
  UiPagedResult,
} from "../models";

/**
 * Chave de cache da listagem de promoções.
 *
 * Só o PREFIXO, como manda o README: quem consulta acrescenta os parâmetros em
 * `[...getGetPromotionsQueryKey(), params ?? {}]`. Uma factory que embutisse os
 * parâmetros faria a invalidação produzir uma chave que não casa com a query
 * registrada — compila, roda, e a listagem simplesmente não atualiza depois de
 * salvar.
 */
export const getGetPromotionsQueryKey = (): QueryKey => ["Promotions"];

/** Filtros da listagem de promoções. */
export interface PromotionFilters {
  /** Trecho do nome do produto promovido. */
  search?: string;
  /** Espécie: 1 = Dia a Dia, 2 = Relâmpago. */
  type?: PromotionTypeCode;
  /**
   * Só as promoções de um produto — é o histórico dele, e é o que responde
   * "vale a pena repetir este produto no cartaz?".
   */
  productGroupId?: number;
  /**
   * Só as com o INDICADOR de ativa ligado.
   *
   * Não é filtro de vigência: promoção encerrada continua aparecendo, que é como
   * ela é encontrada para ser repetida. `false` (o padrão) não filtra nada.
   */
  onlyActive?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Lista as promoções, da mais recente para a mais antiga.
 *
 * Fica no `staleTime` padrão de propósito: a linha carrega preço e margem
 * derivados do cadastro do produto, que muda por fora desta tela.
 */
export function useGetPromotions(
  params?: PromotionFilters,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<PromotionDto>, ApiError, UiPagedResult<PromotionDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<PromotionDto>, ApiError, UiPagedResult<PromotionDto>, QueryKey>({
    queryKey: [...getGetPromotionsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<PromotionDto>>("/Promotions", {
        search: params?.search,
        type: params?.type,
        productGroupId: params?.productGroupId,
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
 * Chave de cache da promoção individual.
 *
 * Prefixo próprio, distinto do da listagem: invalidar `["Promotions"]` não pode
 * arrastar o detalhe junto por casamento parcial, e vice-versa.
 */
export const getGetPromotionByIdQueryKey = (): QueryKey => ["PromotionDetails"];

/**
 * Detalha uma promoção, com a tabela por variação.
 *
 * @param id Promoção; a query fica desabilitada enquanto for indefinido.
 */
export function useGetPromotionById(
  id?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<PromotionDetailsDto, ApiError, PromotionDetailsDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<PromotionDetailsDto, ApiError, PromotionDetailsDto, QueryKey>({
    queryKey: [...getGetPromotionByIdQueryKey(), id ?? 0],
    enabled: !!id,
    queryFn: () => apiGetOrThrow<PromotionDetailsDto>(`/Promotions/${id}`),
    ...options?.query,
  });
}

/**
 * Chave de cache da aba Performance.
 *
 * Prefixo próprio, distinto da listagem e do detalhe: gravar a promoção
 * invalida os dois primeiros, e não há por que refazer quatro consultas de
 * medição porque alguém corrigiu o nome do produto.
 */
export const getGetPromotionPerformanceQueryKey = (): QueryKey => ["PromotionPerformance"];

/**
 * A aba Performance: o que a promoção vendeu, quanto custou e — na relâmpago —
 * que nota tirou.
 *
 * @param id Promoção; a query fica desabilitada enquanto for indefinido, que é o
 *   que impede a aba de consultar antes de a tela saber qual promoção é.
 */
export function useGetPromotionPerformance(
  id?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<PromotionPerformanceDto, ApiError, PromotionPerformanceDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<PromotionPerformanceDto, ApiError, PromotionPerformanceDto, QueryKey>({
    queryKey: [...getGetPromotionPerformanceQueryKey(), id ?? 0],
    enabled: !!id,
    queryFn: () => apiGetOrThrow<PromotionPerformanceDto>(`/Promotions/${id}/performance`),
    ...options?.query,
  });
}

/** Chave de cache da prévia. Prefixo próprio — ela não é nem listagem nem detalhe. */
export const getGetPromotionPreviewQueryKey = (): QueryKey => ["PromotionPreview"];

/** Parâmetros da prévia: o que o formulário está compondo neste momento. */
export interface PromotionPreviewParams {
  productGroupId?: number;
  discountType?: PromotionDiscountTypeCode;
  discountValue?: number;
  /** Meta de unidades, para projetar o investimento. Opcional. */
  targetQuantity?: number | null;
}

/**
 * Prévia do efeito de uma promoção: preço, custo, preço promocional e margem por
 * variação, mais os avisos.
 *
 * A conta é feita no **servidor**, e é a mesma que vai decidir o preço no
 * carrinho. Refazê-la aqui pouparia uma requisição e criaria a divergência
 * clássica — a tela prometendo um número que o balcão não pratica.
 *
 * Desabilitada enquanto não houver produto e tipo de desconto escolhidos: sem os
 * dois não há o que prever, e chamar mesmo assim devolveria 400 a cada tecla.
 */
export function useGetPromotionPreview(
  params: PromotionPreviewParams,
  options?: {
    query?: Omit<
      UseQueryOptions<PromotionPreviewDto, ApiError, PromotionPreviewDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  const enabled = !!params.productGroupId && !!params.discountType;

  return useQuery<PromotionPreviewDto, ApiError, PromotionPreviewDto, QueryKey>({
    queryKey: [...getGetPromotionPreviewQueryKey(), params],
    enabled,
    queryFn: () =>
      apiGetOrThrow<PromotionPreviewDto>("/Promotions/preview", {
        productGroupId: params.productGroupId,
        discountType: params.discountType,
        discountValue: params.discountValue ?? 0,
        targetQuantity: params.targetQuantity ?? undefined,
      }),
    ...options?.query,
  });
}

/**
 * Cria uma promoção.
 *
 * @throws {ApiError} 400 quando já existe promoção do MESMO tipo no período do
 *   produto (relâmpago sobre dia a dia é permitido), quando o banner do site já
 *   está ocupado no horário, quando o preço final não é menor que o de tabela numa
 *   relâmpago, ou quando a janela da relâmpago não cabe num dia.
 */
export async function createPromotion(data: SavePromotionPayload): Promise<PromotionDetailsDto | null> {
  const response = await apiPost<PromotionDetailsDto>("/Promotions", data);
  return response.data;
}

/**
 * Atualiza uma promoção.
 *
 * As mesmas recusas da criação, e mais uma regra de calendário: a promoção não
 * pode ser jogada para um dia passado, porque a janela é o que a medição compara.
 *
 * @throws {ApiError} 400 nas recusas acima; 404 quando a promoção não existe.
 */
export async function updatePromotion(
  id: number,
  data: SavePromotionPayload,
): Promise<PromotionDetailsDto | null> {
  const response = await apiPut<PromotionDetailsDto>(`/Promotions/${id}`, data);
  return response.data;
}

/**
 * Encerra a promoção agora, preservando a janela em que ela valeu.
 *
 * Move o fim da vigência para o instante atual em vez de desativar: desativar
 * apagaria o período em que ela realmente valeu, e a medição passaria a comparar
 * vendas contra um período que a tela não mostra. A que ainda não começou é
 * desativada, porque não houve janela nenhuma.
 *
 * É o primeiro passo do plano B do sábado — encerrar aqui e baixar o preço no
 * cadastro devolve a loja ao método antigo.
 *
 * @throws {ApiError} 400 quando a promoção já estava encerrada.
 */
export async function endPromotionNow(id: number): Promise<PromotionDetailsDto | null> {
  const response = await apiPost<PromotionDetailsDto>(`/Promotions/${id}/encerrar`, {});
  return response.data;
}

/** Exclui logicamente uma promoção. */
export async function deletePromotion(id: number): Promise<void> {
  await apiDelete<null>(`/Promotions/${id}`);
}
