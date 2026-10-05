import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTaskChecklistItem,
  deleteTaskCardAttachment,
  deleteTaskChecklistItem,
  saveTaskCardSolution,
  TASK_CARDS_QUERY_KEY,
  updateTaskCard,
  updateTaskChecklistItem,
  uploadTaskCardAttachment,
  useGetTaskBoardMembers,
  useGetTaskCard,
  useGetTaskLabels,
  type SaveTaskCardPayload,
  type TaskCardChecklistItemDto,
  type TaskCardDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { isBlankRichText } from "@/components/rich-text";

/** O payload de edição a partir do cartão atual, com o que mudou por cima. */
function payloadFrom(card: TaskCardDto, overrides: Partial<SaveTaskCardPayload>): SaveTaskCardPayload {
  return {
    title: card.title,
    description: card.description ?? null,
    labelIds: card.labels.map((l) => l.id),
    memberIds: card.members.map((m) => m.userId),
    ...overrides,
  };
}

/**
 * useTaskCard
 *
 * Hook da modal de detalhe: o cartão completo e cada edição como mutação
 * própria — título, descrição, solução, etiquetas, membros, checklist e anexos.
 * Comentários e histórico estão em `useCardActivity`.
 *
 * Cada campo salva sozinho (ao sair do campo ou marcar a caixa), sem botão
 * "Salvar" geral: é o jeito do Trello, e reduz o que uma pessoa sobrescreve da
 * outra no mesmo cartão — reduz, não elimina: o PUT manda etiquetas e membros
 * inteiros a partir do cartão em cache, então duas modais abertas no mesmo
 * cartão podem desfazer uma a etiqueta da outra. Aceito: o quadro é de uma
 * loja, não de uma equipe de cinquenta. O custo real é que toda mutação
 * invalida o prefixo dos cartões, e o quadro atrás da modal acompanha.
 */
export function useTaskCard(cardId: number | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: card, isLoading, isError } = useGetTaskCard(cardId);
  const { data: labels } = useGetTaskLabels();
  // Quem pode ser membro, pela rota do próprio quadro.
  const { data: members } = useGetTaskBoardMembers();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: TASK_CARDS_QUERY_KEY });

  const fail = (title: string) => (error: unknown) =>
    toast({ title, description: describeApiError(error), error, variant: "destructive" });

  const saveMutation = useMutation({
    mutationFn: (overrides: Partial<SaveTaskCardPayload>) =>
      updateTaskCard(card!.id, payloadFrom(card!, overrides)),
    onSuccess: invalidate,
    onError: fail("Erro ao salvar o cartão"),
  });

  // Rota própria, fora do PUT do cartão: ver `saveTaskCardSolution`.
  const solutionMutation = useMutation({
    mutationFn: (input: { solution: string | null; finish: boolean }) =>
      saveTaskCardSolution(card!.id, input),
    onSuccess: async (_data, input) => {
      await invalidate();
      if (input.finish) toast({ title: `Solução salva e tarefa #${card?.number} finalizada.` });
    },
    onError: fail("Erro ao salvar a solução"),
  });

  const checklistAddMutation = useMutation({
    mutationFn: (text: string) => addTaskChecklistItem(card!.id, { text, isDone: false }),
    onSuccess: invalidate,
    onError: fail("Erro ao adicionar o item"),
  });

  const checklistUpdateMutation = useMutation({
    mutationFn: (input: { item: TaskCardChecklistItemDto; text?: string; isDone?: boolean }) =>
      updateTaskChecklistItem(card!.id, input.item.id, {
        text: input.text ?? input.item.text,
        isDone: input.isDone ?? input.item.isDone,
      }),
    onSuccess: invalidate,
    onError: fail("Erro ao atualizar o item"),
  });

  const checklistDeleteMutation = useMutation({
    mutationFn: (itemId: number) => deleteTaskChecklistItem(card!.id, itemId),
    onSuccess: invalidate,
    onError: fail("Erro ao remover o item"),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadTaskCardAttachment(card!.id, file),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Anexo enviado." });
    },
    onError: fail("Erro ao enviar o anexo"),
  });

  const attachmentDeleteMutation = useMutation({
    mutationFn: (attachmentId: number) => deleteTaskCardAttachment(card!.id, attachmentId),
    onSuccess: invalidate,
    onError: fail("Erro ao remover o anexo"),
  });

  /** Liga/desliga uma etiqueta no cartão. */
  function toggleLabel(labelId: number) {
    if (!card) return;
    const current = card.labels.map((l) => l.id);
    const labelIds = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    saveMutation.mutate({ labelIds });
  }

  /** Liga/desliga um membro no cartão. */
  function toggleMember(userId: number) {
    if (!card) return;
    const current = card.members.map((m) => m.userId);
    const memberIds = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    saveMutation.mutate({ memberIds });
  }

  /** Salva o título se mudou e não ficou vazio (vazio é recusado pelo servidor; nem manda). */
  function saveTitle(title: string) {
    if (!card) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === card.title) return;
    saveMutation.mutate({ title: trimmed });
  }

  /**
   * HTML do editor; vazio ("" ou `<p></p>`) apaga a descrição. Devolve a promessa
   * da gravação (rejeita se falhar) para o campo só fechar depois de gravado.
   */
  function saveDescription(description: string): Promise<unknown> {
    if (!card) return Promise.resolve();
    const next = isBlankRichText(description) ? null : description.trim();
    if (next === (card.description ?? null)) return Promise.resolve();
    return saveMutation.mutateAsync({ description: next });
  }

  /**
   * Solução: HTML do editor, vazio apaga. Com `finish`, o servidor também leva o
   * cartão para Finalizado na mesma gravação — mesmo sem mudança no texto, que é
   * o "Salvar e finalizar" de uma solução já registrada.
   */
  function saveSolution(solution: string, finish = false): Promise<unknown> {
    if (!card) return Promise.resolve();
    const next = isBlankRichText(solution) ? null : solution.trim();
    if (next === (card.solution ?? null) && !finish) return Promise.resolve();
    return solutionMutation.mutateAsync({ solution: next, finish });
  }

  return {
    card: card ?? null,
    isLoading,
    isError,
    labels: labels ?? [],
    users: members ?? [],

    saveTitle,
    saveDescription,
    toggleLabel,
    toggleMember,
    isSaving: saveMutation.isPending,
    saveSolution,
    isSavingSolution: solutionMutation.isPending,

    addChecklistItem: (text: string) => checklistAddMutation.mutateAsync(text),
    toggleChecklistItem: (item: TaskCardChecklistItemDto) =>
      checklistUpdateMutation.mutate({ item, isDone: !item.isDone }),
    renameChecklistItem: (item: TaskCardChecklistItemDto, text: string) =>
      checklistUpdateMutation.mutate({ item, text }),
    deleteChecklistItem: (itemId: number) => checklistDeleteMutation.mutate(itemId),
    isChecklistBusy: checklistAddMutation.isPending || checklistUpdateMutation.isPending,

    uploadAttachment: (file: File) => uploadMutation.mutateAsync(file),
    isUploading: uploadMutation.isPending,
    deleteAttachment: (attachmentId: number) => attachmentDeleteMutation.mutateAsync(attachmentId),
    isDeletingAttachment: attachmentDeleteMutation.isPending,
  };
}

export type TaskCardController = ReturnType<typeof useTaskCard>;
