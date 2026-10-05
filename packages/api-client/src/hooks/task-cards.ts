/**
 * Quadro de tarefas — cartões, etiquetas, checklist, anexos, solução e a linha
 * do tempo (comentários e histórico).
 *
 * Contrato do backend em `Uaus.Backend.Api/Uaus.Api/Controllers/TaskCardsController.cs`
 * e `TaskLabelsController.cs`.
 *
 * Todas as chaves de cache dos cartões começam com `TASK_CARDS_QUERY_KEY`: uma
 * mutação em qualquer parte do cartão (mover, checklist, anexo…) invalida esse
 * prefixo e o quadro, o detalhe, a busca e os arquivados atualizam juntos. É
 * mais barato do que lembrar, em cada mutação, quais das quatro listas mudaram.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError } from "../client";
import type {
  MoveTaskCardPayload,
  QueryKey,
  SaveTaskCardCommentPayload,
  SaveTaskCardPayload,
  SaveTaskCardSolutionPayload,
  SaveTaskChecklistItemPayload,
  SaveTaskLabelPayload,
  TaskBoardDto,
  TaskCardActivityDto,
  TaskCardAttachmentDto,
  TaskCardChecklistItemDto,
  TaskCardDto,
  TaskCardMemberDto,
  TaskCardSummaryDto,
  TaskLabelDto,
} from "../models";

/** Prefixo comum a TODAS as consultas de cartões. Invalide este para atualizar o quadro inteiro. */
export const TASK_CARDS_QUERY_KEY = ["TaskCards"] as const;

/** Chave de cache do quadro (cartões não arquivados). */
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

/** Chave de cache da lista de arquivados. */
export const getGetArchivedTaskCardsQueryKey = (): QueryKey => [...TASK_CARDS_QUERY_KEY, "archived"];

/** Chave de cache das etiquetas. */
export const getGetTaskLabelsQueryKey = (): QueryKey => ["TaskLabels"];

/** Chave de cache de quem pode ser membro. Fora do prefixo dos cartões: mexer em cartão não muda a lista de usuários. */
export const getGetTaskBoardMembersQueryKey = (): QueryKey => ["TaskBoardMembers"];

type QueryOpts<T> = {
  query?: Omit<UseQueryOptions<T, ApiError, T, QueryKey>, "queryKey" | "queryFn">;
};

/**
 * O quadro: cartões não arquivados, por coluna.
 *
 * @param params `allFinished` inclui os finalizados fora da janela de 30 dias.
 */
export function useGetTaskBoard(params?: { allFinished?: boolean }, options?: QueryOpts<TaskBoardDto>) {
  return useQuery<TaskBoardDto, ApiError, TaskBoardDto, QueryKey>({
    queryKey: [...getGetTaskBoardQueryKey(), params ?? {}],
    queryFn: () =>
      apiGetOrThrow<TaskBoardDto>("/TaskCards/board", { allFinished: params?.allFinished ?? false }),
    ...options?.query,
  });
}

/** O cartão completo (descrição, checklist, anexos). `id` nulo desliga a consulta. */
export function useGetTaskCard(id: number | null, options?: QueryOpts<TaskCardDto>) {
  return useQuery<TaskCardDto, ApiError, TaskCardDto, QueryKey>({
    queryKey: [...getGetTaskCardQueryKey(), { id }],
    queryFn: () => apiGetOrThrow<TaskCardDto>(`/TaskCards/${id}`),
    enabled: id != null,
    ...options?.query,
  });
}

/** Comentários e histórico do cartão, do mais antigo para o mais recente. `id` nulo desliga a consulta. */
export function useGetTaskCardActivities(id: number | null, options?: QueryOpts<TaskCardActivityDto[]>) {
  return useQuery<TaskCardActivityDto[], ApiError, TaskCardActivityDto[], QueryKey>({
    queryKey: [...getGetTaskCardActivitiesQueryKey(), { id }],
    queryFn: () => apiGetOrThrow<TaskCardActivityDto[]>(`/TaskCards/${id}/activities`),
    enabled: id != null,
    ...options?.query,
  });
}

/**
 * Busca global: número ("#37"), título, descrição, etiqueta e checklist,
 * inclusive nos arquivados. Termo vazio desliga a consulta.
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

/** Os cartões arquivados, do mais recente ao mais antigo. */
export function useGetArchivedTaskCards(options?: QueryOpts<TaskCardSummaryDto[]>) {
  return useQuery<TaskCardSummaryDto[], ApiError, TaskCardSummaryDto[], QueryKey>({
    queryKey: [...getGetArchivedTaskCardsQueryKey(), {}],
    queryFn: () => apiGetOrThrow<TaskCardSummaryDto[]>("/TaskCards/archived"),
    ...options?.query,
  });
}

/**
 * Quem pode ser membro de um cartão (usuários ativos ou pendentes, por nome).
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

/** Todas as etiquetas vivas, da mais urgente para a menos. */
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

/** Cria o cartão no fim da coluna pedida. Devolve o cartão completo, já com o número. */
export async function createTaskCard(data: SaveTaskCardPayload): Promise<TaskCardDto | null> {
  const response = await apiPost<TaskCardDto>("/TaskCards", data);
  return response.data;
}

/** Título, descrição, etiquetas e membros. Coluna e posição: `moveTaskCard`. */
export async function updateTaskCard(id: number, data: SaveTaskCardPayload): Promise<TaskCardDto | null> {
  const response = await apiPut<TaskCardDto>(`/TaskCards/${id}`, data);
  return response.data;
}

/** Muda coluna e/ou posição. O backend recusa cartão arquivado. */
export async function moveTaskCard(
  id: number,
  data: MoveTaskCardPayload,
): Promise<TaskCardSummaryDto | null> {
  const response = await apiPut<TaskCardSummaryDto>(`/TaskCards/${id}/move`, data);
  return response.data;
}

export async function archiveTaskCard(id: number): Promise<TaskCardDto | null> {
  const response = await apiPost<TaskCardDto>(`/TaskCards/${id}/archive`, {});
  return response.data;
}

/** Volta para a coluna em que estava, no fim dela. */
export async function unarchiveTaskCard(id: number): Promise<TaskCardDto | null> {
  const response = await apiPost<TaskCardDto>(`/TaskCards/${id}/unarchive`, {});
  return response.data;
}

/** Exclusão lógica. O número do cartão não volta a ser usado. */
export async function deleteTaskCard(id: number): Promise<void> {
  await apiDelete<null>(`/TaskCards/${id}`);
}

export async function addTaskChecklistItem(
  cardId: number,
  data: SaveTaskChecklistItemPayload,
): Promise<TaskCardChecklistItemDto | null> {
  const response = await apiPost<TaskCardChecklistItemDto>(`/TaskCards/${cardId}/checklist`, data);
  return response.data;
}

export async function updateTaskChecklistItem(
  cardId: number,
  itemId: number,
  data: SaveTaskChecklistItemPayload,
): Promise<TaskCardChecklistItemDto | null> {
  const response = await apiPut<TaskCardChecklistItemDto>(`/TaskCards/${cardId}/checklist/${itemId}`, data);
  return response.data;
}

export async function deleteTaskChecklistItem(cardId: number, itemId: number): Promise<void> {
  await apiDelete<null>(`/TaskCards/${cardId}/checklist/${itemId}`);
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
 * Registra, edita ou apaga (vazio) a solução. Com `finish`, o servidor também leva
 * o cartão para o fim de Finalizado, na mesma gravação — e recusa se ele estiver
 * arquivado, sem salvar a solução. Fica fora do `updateTaskCard` de propósito:
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

/** Exclusão lógica: a etiqueta some de todos os cartões. */
export async function deleteTaskLabel(id: number): Promise<void> {
  await apiDelete<null>(`/TaskLabels/${id}`);
}
