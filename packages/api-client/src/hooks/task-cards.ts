/**
 * Tarefas — a lista de pendentes e finalizadas, etiquetas, anexos, solução e a
 * linha do tempo (comentários e histórico). Até 23/10/2026 era um quadro de cinco
 * colunas; as rotas e os nomes ("cards", "board") ficaram de lá.
 *
 * Contrato do backend em `Uaus.Backend.Api/Uaus.Api/Controllers/TaskCardsController.cs`
 * e `TaskLabelsController.cs`.
 *
 * Todas as chaves de cache das tarefas começam com `TASK_CARDS_QUERY_KEY`: uma
 * mutação em qualquer parte da tarefa (concluir, anexo, responsável…) invalida esse
 * prefixo e a lista, o detalhe e a busca atualizam juntos. É mais barato do que
 * lembrar, em cada mutação, quais das listas mudaram.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError } from "../client";
import type {
  MoveTaskCardPayload,
  QueryKey,
  SaveTaskCardCommentPayload,
  SaveTaskCardPayload,
  SaveTaskCardSolutionPayload,
  SaveTaskLabelPayload,
  TaskBoardDto,
  TaskCardActivityDto,
  TaskCardAttachmentDto,
  TaskCardDto,
  TaskCardMemberDto,
  TaskCardSummaryDto,
  TaskLabelDto,
} from "../models";

/** Prefixo comum a TODAS as consultas de cartões. Invalide este para atualizar o quadro inteiro. */
export const TASK_CARDS_QUERY_KEY = ["TaskCards"] as const;

/** Chave de cache da lista (pendentes e finalizadas da janela). */
export const getGetTaskBoardQueryKey = (): QueryKey => [...TASK_CARDS_QUERY_KEY, "board"];

/** Chave de cache do detalhe de um cartão. */
export const getGetTaskCardQueryKey = (): QueryKey => [...TASK_CARDS_QUERY_KEY, "detail"];

/**
 * Chave de cache da linha do tempo (comentários e histórico) de um cartão. Dentro
 * do prefixo dos cartões de propósito: toda ação no cartão grava uma linha nova,
 * e a invalidação que já existe em cada mutação a traz junto.
 */
export const getGetTaskCardActivitiesQueryKey = (): QueryKey => [...TASK_CARDS_QUERY_KEY, "activities"];

/** Chave de cache da busca global. */
export const getSearchTaskCardsQueryKey = (): QueryKey => [...TASK_CARDS_QUERY_KEY, "search"];

/** Chave de cache das etiquetas. */
export const getGetTaskLabelsQueryKey = (): QueryKey => ["TaskLabels"];

/** Chave de cache de quem pode ser responsável. Fora do prefixo das tarefas: mexer em tarefa não muda a lista de usuários. */
export const getGetTaskBoardMembersQueryKey = (): QueryKey => ["TaskBoardMembers"];

type QueryOpts<T> = {
  query?: Omit<UseQueryOptions<T, ApiError, T, QueryKey>, "queryKey" | "queryFn">;
};

/**
 * A lista: as pendentes e as finalizadas dos últimos 30 dias, da mais urgente para
 * a menos. A tela filtra por pessoa e situação sem nova consulta.
 *
 * @param params `allFinished` inclui as finalizadas fora da janela de 30 dias.
 */
export function useGetTaskBoard(params?: { allFinished?: boolean }, options?: QueryOpts<TaskBoardDto>) {
  return useQuery<TaskBoardDto, ApiError, TaskBoardDto, QueryKey>({
    queryKey: [...getGetTaskBoardQueryKey(), params ?? {}],
    queryFn: () =>
      apiGetOrThrow<TaskBoardDto>("/TaskCards/board", { allFinished: params?.allFinished ?? false }),
    ...options?.query,
  });
}

/** A tarefa completa (descrição, solução, anexos). `id` nulo desliga a consulta. */
export function useGetTaskCard(id: number | null, options?: QueryOpts<TaskCardDto>) {
  return useQuery<TaskCardDto, ApiError, TaskCardDto, QueryKey>({
    queryKey: [...getGetTaskCardQueryKey(), { id }],
    queryFn: () => apiGetOrThrow<TaskCardDto>(`/TaskCards/${id}`),
    enabled: id != null,
    ...options?.query,
  });
}

/** Comentários e histórico da tarefa, do mais antigo para o mais recente. `id` nulo desliga a consulta. */
export function useGetTaskCardActivities(id: number | null, options?: QueryOpts<TaskCardActivityDto[]>) {
  return useQuery<TaskCardActivityDto[], ApiError, TaskCardActivityDto[], QueryKey>({
    queryKey: [...getGetTaskCardActivitiesQueryKey(), { id }],
    queryFn: () => apiGetOrThrow<TaskCardActivityDto[]>(`/TaskCards/${id}/activities`),
    enabled: id != null,
    ...options?.query,
  });
}

/**
 * Busca global: número ("#37"), título, descrição, solução, comentário e etiqueta,
 * inclusive nas finalizadas antigas. Termo vazio desliga a consulta.
 */
export function useSearchTaskCards(term: string, options?: QueryOpts<TaskCardSummaryDto[]>) {
  const q = term.trim();
  return useQuery<TaskCardSummaryDto[], ApiError, TaskCardSummaryDto[], QueryKey>({
    queryKey: [...getSearchTaskCardsQueryKey(), { q }],
    queryFn: () => apiGetOrThrow<TaskCardSummaryDto[]>("/TaskCards/search", { q, limit: 30 }),
    enabled: q.length > 0,
    ...options?.query,
  });
}

/**
 * Quem pode ser responsável por uma tarefa (usuários ativos ou pendentes, por nome).
 * É `GET /TaskCards/members`, e não `GET /Users`: só id e nome, que é o que o
 * seletor mostra.
 */
export function useGetTaskBoardMembers(options?: QueryOpts<TaskCardMemberDto[]>) {
  return useQuery<TaskCardMemberDto[], ApiError, TaskCardMemberDto[], QueryKey>({
    queryKey: [...getGetTaskBoardMembersQueryKey(), {}],
    queryFn: () => apiGetOrThrow<TaskCardMemberDto[]>("/TaskCards/members"),
    ...options?.query,
  });
}

/** Todas as etiquetas vivas, por nome. */
export function useGetTaskLabels(options?: QueryOpts<TaskLabelDto[]>) {
  return useQuery<TaskLabelDto[], ApiError, TaskLabelDto[], QueryKey>({
    queryKey: [...getGetTaskLabelsQueryKey(), {}],
    queryFn: () => apiGetOrThrow<TaskLabelDto[]>("/TaskLabels"),
    ...options?.query,
  });
}

// ---------------------------------------------------------------------------
// Mutações — funções puras; o `useMutation` fica no hook da feature.
// ---------------------------------------------------------------------------

/** Cria a tarefa, sempre Pendente. Devolve a tarefa completa, já com o número. */
export async function createTaskCard(data: SaveTaskCardPayload): Promise<TaskCardDto | null> {
  const response = await apiPost<TaskCardDto>("/TaskCards", data);
  return response.data;
}

/** Título, descrição, prioridade, responsável e etiquetas. Concluir e reabrir: `moveTaskCard`. */
export async function updateTaskCard(id: number, data: SaveTaskCardPayload): Promise<TaskCardDto | null> {
  const response = await apiPut<TaskCardDto>(`/TaskCards/${id}`, data);
  return response.data;
}

/** Conclui (`Done`) ou reabre (`Pending`). O backend recusa as colunas do quadro antigo. */
export async function moveTaskCard(
  id: number,
  data: MoveTaskCardPayload,
): Promise<TaskCardSummaryDto | null> {
  const response = await apiPut<TaskCardSummaryDto>(`/TaskCards/${id}/move`, data);
  return response.data;
}

/** Exclusão lógica. O número da tarefa não volta a ser usado. */
export async function deleteTaskCard(id: number): Promise<void> {
  await apiDelete<null>(`/TaskCards/${id}`);
}

/**
 * Anexa um arquivo (multipart, campo "File"). O backend aceita imagens, PDF,
 * Office, CSV, TXT, ZIP, vídeo e áudio, até 10 MB, e guarda na pasta do cartão
 * no S3.
 */
export async function uploadTaskCardAttachment(
  cardId: number,
  file: File,
): Promise<TaskCardAttachmentDto | null> {
  const formData = new FormData();
  formData.append("File", file);

  const response = await apiPost<TaskCardAttachmentDto>(`/TaskCards/${cardId}/attachments`, formData);
  return response.data;
}

export async function deleteTaskCardAttachment(cardId: number, attachmentId: number): Promise<void> {
  await apiDelete<null>(`/TaskCards/${cardId}/attachments/${attachmentId}`);
}

/**
 * Registra, edita ou apaga (vazio) a solução. Com `finish`, o servidor também
 * conclui a tarefa, na mesma gravação. Fica fora do `updateTaskCard` de propósito:
 * um admin aberto antes da solução existir mandaria o PUT sem ela e a apagaria.
 */
export async function saveTaskCardSolution(
  cardId: number,
  data: SaveTaskCardSolutionPayload,
): Promise<TaskCardDto | null> {
  const response = await apiPut<TaskCardDto>(`/TaskCards/${cardId}/solution`, data);
  return response.data;
}

export async function addTaskCardComment(
  cardId: number,
  data: SaveTaskCardCommentPayload,
): Promise<TaskCardActivityDto | null> {
  const response = await apiPost<TaskCardActivityDto>(`/TaskCards/${cardId}/comments`, data);
  return response.data;
}

/** Só o autor edita; o servidor recusa o comentário de outra pessoa. */
export async function updateTaskCardComment(
  cardId: number,
  commentId: number,
  data: SaveTaskCardCommentPayload,
): Promise<TaskCardActivityDto | null> {
  const response = await apiPut<TaskCardActivityDto>(`/TaskCards/${cardId}/comments/${commentId}`, data);
  return response.data;
}

/** Exclusão lógica; só o autor exclui. */
export async function deleteTaskCardComment(cardId: number, commentId: number): Promise<void> {
  await apiDelete<null>(`/TaskCards/${cardId}/comments/${commentId}`);
}

export async function createTaskLabel(data: SaveTaskLabelPayload): Promise<TaskLabelDto | null> {
  const response = await apiPost<TaskLabelDto>("/TaskLabels", data);
  return response.data;
}

export async function updateTaskLabel(id: number, data: SaveTaskLabelPayload): Promise<TaskLabelDto | null> {
  const response = await apiPut<TaskLabelDto>(`/TaskLabels/${id}`, data);
  return response.data;
}

/** Exclusão lógica: a etiqueta some de todas as tarefas. */
export async function deleteTaskLabel(id: number): Promise<void> {
  await apiDelete<null>(`/TaskLabels/${id}`);
}
