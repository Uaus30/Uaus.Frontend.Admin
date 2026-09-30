/**
 * Quadro de tarefas — cartões, etiquetas, checklist e anexos.
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
  SaveTaskCardPayload,
  SaveTaskChecklistItemPayload,
  SaveTaskLabelPayload,
  TaskBoardDto,
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
 * É `GET /TaskCards/members`, e não `GET /Users`: aquele é só de Admin, e o
 * quadro é de todo papel — o Vendedor abriria o seletor vazio.
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
