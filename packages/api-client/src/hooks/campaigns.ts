/**
 * Campanhas de marketing — cadastro, questionário e relatórios.
 *
 * O balcão nunca chega nestas rotas: o PDV consulta o cupom pelo código e
 * recebe as perguntas já resolvidas, sem saber que a campanha existe. Tudo aqui
 * exige o papel **Admin** — não há papel de marketing no sistema.
 *
 * Os cupons de uma campanha saem de `useGetCoupons({ campaignId })`, e não de
 * uma coleção dentro da campanha: é a mesma tabela paginada da tela de cupons.
 *
 * Contrato em PLANO-CUPONS-CAMPANHAS.md e em `CampaignsController` do backend.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
import { STALE_TIME } from "../query-client";
import type {
  BackendPagedResult,
  CampaignComparisonRowDto,
  CampaignDto,
  CampaignReportDto,
  QueryKey,
  SaveCampaignPayload,
  UiPagedResult,
} from "../models";

/** Chave de cache da listagem de campanhas (só o prefixo — ver o README do pacote). */
export const getGetCampaignsQueryKey = (): QueryKey => ["Campaigns"];

/** Filtros da listagem de campanhas. */
export interface CampaignFilters {
  /** Trecho do nome. */
  search?: string;
  /**
   * Só as vigentes no INSTANTE informado ("2026-09-30T23:59:59").
   *
   * É instante, não data: uma campanha pode começar às 14h. Mandar
   * "2026-09-30" faria o servidor ler meia-noite e a campanha da tarde ficaria
   * de fora da própria data em que está no ar.
   */
  activeAt?: string;
  page?: number;
  limit?: number;
}

/**
 * Lista as campanhas, **sem o questionário** (a listagem devolve `questions: []`).
 *
 * `STALE_TIME.catalogo`: nome, período e indicador de ativo só mudam quando
 * alguém edita, e quem edita invalida a chave — o refetch por tempo aqui é rede
 * de segurança, não o caminho normal.
 */
export function useGetCampaigns(
  params?: CampaignFilters,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<CampaignDto>, ApiError, UiPagedResult<CampaignDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<CampaignDto>, ApiError, UiPagedResult<CampaignDto>, QueryKey>({
    queryKey: [...getGetCampaignsQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<CampaignDto>>("/Campaigns", {
        search: params?.search,
        activeAt: params?.activeAt,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    staleTime: STALE_TIME.catalogo,
    ...options?.query,
  });
}

/** Chave de cache da campanha individual, com prefixo distinto do da listagem. */
export const getGetCampaignByIdQueryKey = (): QueryKey => ["CampaignDetails"];

/**
 * Detalha uma campanha **com o questionário completo** — perguntas e opções
 * ordenadas, sem as excluídas logicamente. É esta a leitura que alimenta o
 * editor, porque a listagem não traz pergunta nenhuma.
 *
 * @param id Campanha; a query fica desabilitada enquanto for indefinido.
 */
export function useGetCampaignById(
  id?: number,
  options?: {
    query?: Omit<UseQueryOptions<CampaignDto, ApiError, CampaignDto, QueryKey>, "queryKey" | "queryFn">;
  },
) {
  return useQuery<CampaignDto, ApiError, CampaignDto, QueryKey>({
    queryKey: [...getGetCampaignByIdQueryKey(), id ?? 0],
    enabled: !!id,
    queryFn: () => apiGetOrThrow<CampaignDto>(`/Campaigns/${id}`),
    staleTime: STALE_TIME.catalogo,
    ...options?.query,
  });
}

/**
 * Cria a campanha e o questionário inteiro numa transação só.
 *
 * @throws {ApiError} 400 quando o nome falta, o fim é anterior ao início, há
 *   mais de 6 perguntas, alguma tem menos de 2 ou mais de 8 opções, ou duas
 *   opções da mesma pergunta repetem o rótulo.
 * @returns A campanha criada, ou null se a resposta vier sem corpo.
 */
export async function createCampaign(data: SaveCampaignPayload): Promise<CampaignDto | null> {
  const response = await apiPost<CampaignDto>("/Campaigns", data);
  return response.data;
}

/**
 * Atualiza a campanha e **reconcilia o questionário inteiro**: pergunta ou opção
 * com id é atualizada, sem id é criada, e a que não vier na lista é excluída
 * logicamente.
 *
 * Mande sempre o questionário completo, nunca um delta — enviar só o que mudou
 * apagaria todo o resto, e a exclusão sendo lógica o estrago não aparece no
 * banco, aparece na tela do balcão.
 *
 * @throws {ApiError} 400 nas mesmas validações do `createCampaign`; 404 quando a
 *   campanha não existe.
 */
export async function updateCampaign(
  id: number,
  data: SaveCampaignPayload,
): Promise<CampaignDto | null> {
  const response = await apiPut<CampaignDto>(`/Campaigns/${id}`, data);
  return response.data;
}

/**
 * Exclui logicamente a campanha.
 *
 * Os cupons ligados **continuam valendo** — o que acaba é a apresentação do
 * questionário no balcão. Vigência de campanha não decide dinheiro.
 */
export async function deleteCampaign(id: number): Promise<void> {
  await apiDelete<null>(`/Campaigns/${id}`);
}

/** Chave de cache do relatório de uma campanha. */
export const getGetCampaignReportQueryKey = (): QueryKey => ["CampaignReport"];

/**
 * Relatório da campanha: o que ela moveu contra o que a loja fez no MESMO
 * intervalo.
 *
 * Fica no `staleTime` padrão (`STALE_TIME.operacao`): o relatório de uma
 * campanha no ar muda a cada venda do balcão, e é justamente enquanto ela está
 * rodando que alguém olha para decidir se continua.
 *
 * @param campaignId Campanha; a query fica desabilitada enquanto for indefinida.
 */
export function useGetCampaignReport(
  campaignId?: number,
  options?: {
    query?: Omit<
      UseQueryOptions<CampaignReportDto, ApiError, CampaignReportDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<CampaignReportDto, ApiError, CampaignReportDto, QueryKey>({
    queryKey: [...getGetCampaignReportQueryKey(), campaignId ?? 0],
    enabled: !!campaignId,
    queryFn: () => apiGetOrThrow<CampaignReportDto>(`/Campaigns/${campaignId}/report`),
    ...options?.query,
  });
}

/** Chave de cache do comparativo entre campanhas. */
export const getGetCampaignComparisonQueryKey = (): QueryKey => ["CampaignComparison"];

/** Teto de campanhas por comparativo, imposto pelo servidor (400 acima disso). */
export const MAX_COMPARISON_CAMPAIGNS = 12;

/** Parâmetros do comparativo entre campanhas. */
export interface CampaignComparisonParams {
  /**
   * Campanhas a comparar. Pelo menos uma e no máximo
   * {@link MAX_COMPARISON_CAMPAIGNS} — o servidor recusa lista vazia com 400, e
   * doze barras já é o limite do que um gráfico comparativo mostra sem virar
   * borrão.
   */
  ids: number[];
  /**
   * Recorta o INÍCIO da janela de cada campanha (instante, não data). Sem valor,
   * cada uma é medida no período dela inteiro. O recorte só **encolhe**:
   * campanha de agosto consultada com filtro de setembro sai zerada, e não com
   * as vendas de setembro.
   */
  from?: string;
  /** Recorta o fim da janela, inclusivo. Instante, não data. */
  to?: string;
}

/**
 * Compara campanhas lado a lado, uma linha por campanha, para o gráfico de
 * barras e para a exportação em CSV.
 *
 * Cada linha tem a própria janela e o próprio denominador — é por isso que os
 * percentuais existem, e é por isso que `windowStart`/`windowEnd` viajam junto:
 * o CSV é lido fora do sistema meses depois, e faturamento sem a janela ao lado
 * é número que ninguém reproduz.
 *
 * Id inexistente ou excluído é ignorado pelo servidor em vez de derrubar a
 * resposta — uma campanha apagada em outra aba não pode transformar o
 * comparativo inteiro em 404.
 */
export function useGetCampaignComparison(
  params: CampaignComparisonParams,
  options?: {
    query?: Omit<
      UseQueryOptions<CampaignComparisonRowDto[], ApiError, CampaignComparisonRowDto[], QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  const ids = params.ids.join(",");

  return useQuery<CampaignComparisonRowDto[], ApiError, CampaignComparisonRowDto[], QueryKey>({
    queryKey: [...getGetCampaignComparisonQueryKey(), { ids, from: params.from, to: params.to }],
    // Sem campanha selecionada o servidor responde 400 ("informe ao menos uma
    // campanha"), o que viraria uma mensagem de erro na tela de quem apenas
    // ainda não escolheu nada.
    enabled: params.ids.length > 0,
    queryFn: () =>
      apiGetOrThrow<CampaignComparisonRowDto[]>("/Campaigns/comparison", {
        ids,
        from: params.from,
        to: params.to,
      }),
    ...options?.query,
  });
}
