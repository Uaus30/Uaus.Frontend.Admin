import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTaskChecklistItem,
  deleteTaskCardAttachment,
  deleteTaskChecklistItem,
  getGetTaskCardQueryKey,
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
  type TaskCardMemberDto,
  type TaskLabelDto,
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

/** Etiquetas e membros escolhidos num clique — a parte do PUT que a modal antecipa. */
type Selection = Pick<Partial<SaveTaskCardPayload>, "labelIds" | "memberIds">;

/**
 * O cartão com a seleção nova de etiquetas e membros — o que a modal mostra
 * enquanto o PUT viaja. Etiqueta e membro saem do próprio cartão ou das listas
 * completas; id que nenhuma das duas conhece some, como sumiria no servidor.
 */
function withSelection(
  card: TaskCardDto,
  selection: Selection,
  labels: TaskLabelDto[],
  users: TaskCardMemberDto[],
): TaskCardDto {
  const labelById = new Map([...labels, ...card.labels].map((l) => [l.id, l]));
  const memberById = new Map([...users, ...card.members].map((m) => [m.userId, m]));
  return {
    ...card,
    labels: selection.labelIds?.flatMap((id) => labelById.get(id) ?? []) ?? card.labels,
    members: selection.memberIds?.flatMap((id) => memberById.get(id) ?? []) ?? card.members,
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
 *
 * **Duas gravações seguidas na MESMA modal não se atropelam** (06/10/2026).
 * Antes, marcar a etiqueta A e logo a B mandava dois PUTs montados do cartão
 * ainda sem a A — o segundo levava só a B, e a A se perdia; o mesmo valia para
 * etiqueta seguida de membro ou de título. Agora:
 *
 * - os PUTs do cartão fazem fila (`scope`) e chegam ao servidor na ordem em que
 *   foram feitos;
 * - cada PUT é montado na hora de SAIR da fila, a partir do cartão do cache —
 *   a gravação anterior já respondeu;
 * - etiqueta e membro entram no cache no clique (a marca aparece na hora, e o
 *   clique seguinte parte dela); título e descrição, só depois de gravados;
 * - o cartão só é relido depois do último PUT da fila: reler no meio traria do
 *   servidor o estado sem a gravação seguinte e apagaria a marca.
 *
 * Título e descrição não são antecipados porque o campo de texto da modal
 * remonta quando o valor do cartão muda (`key`): antecipar fechava o editor na
 * hora e, se o servidor recusasse (descrição longa demais, rede), o rascunho
 * sumia — o defeito que `CardRichTextField.finishWith` já tinha corrigido. Montar
 * o PUT na saída também impede que um texto recusado vá de carona no seguinte.
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

  const cardKey = [...getGetTaskCardQueryKey(), { id: cardId }];
  const saveKey = ["task-card-save", cardId];

  /**
   * O cartão como está AGORA, com as marcas ainda em voo. Lido do cache, e não
   * do `card` da última renderização: dois cliques no mesmo instante ainda não
   * renderizaram o primeiro.
   */
  function currentCard(): TaskCardDto | undefined {
    return queryClient.getQueryData<TaskCardDto>(cardKey) ?? card;
  }

  const saveMutation = useMutation({
    mutationKey: saveKey,
    scope: { id: `task-card-save-${cardId}` },
    // Montado na SAÍDA da fila: o cache já tem o que a gravação anterior gravou
    // — ou não tem, se ela falhou, e o texto recusado não vai de carona nesta.
    mutationFn: (overrides: Partial<SaveTaskCardPayload>) => {
      const current = currentCard();
      if (!current) throw new Error("O cartão ainda não foi carregado.");
      return updateTaskCard(cardId!, payloadFrom(current, overrides));
    },
    onSuccess: (_data, { title, description }) => {
      if (title === undefined && description === undefined) return;
      queryClient.setQueryData<TaskCardDto>(
        cardKey,
        (now) =>
          now && {
            ...now,
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
          },
      );
    },
    onError: fail("Erro ao salvar o cartão"),
    // Esta gravação ainda conta como pendente aqui; 1 é "sou a última da fila".
    // Com erro também relê: a marca que não gravou some.
    onSettled: () => (queryClient.isMutating({ mutationKey: saveKey }) <= 1 ? invalidate() : undefined),
  });

  /** Mostra a marca na hora e põe o PUT na fila. */
  function saveSelection(selection: Selection) {
    const now = currentCard();
    if (!now) return;
    // Uma releitura em voo responderia com o cartão de antes deste clique.
    void queryClient.cancelQueries({ queryKey: cardKey });
    queryClient.setQueryData<TaskCardDto>(
      cardKey,
      withSelection(now, selection, labels ?? [], members ?? []),
    );
    saveMutation.mutate(selection);
  }

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
    const now = currentCard();
    if (!now) return;
    const current = now.labels.map((l) => l.id);
    const labelIds = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    saveSelection({ labelIds });
  }

  /** Liga/desliga um membro no cartão. */
  function toggleMember(userId: number) {
    const now = currentCard();
    if (!now) return;
    const current = now.members.map((m) => m.userId);
    const memberIds = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    saveSelection({ memberIds });
  }

  /** Salva o título se mudou e não ficou vazio (vazio é recusado pelo servidor; nem manda). */
  function saveTitle(title: string) {
    const now = currentCard();
    if (!now) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === now.title) return;
    saveMutation.mutate({ title: trimmed });
  }

  /**
   * HTML do editor; vazio ("" ou `<p></p>`) apaga a descrição. Devolve a promessa
   * da gravação (rejeita se falhar) para o campo só fechar depois de gravado.
   */
  function saveDescription(description: string): Promise<unknown> {
    const now = currentCard();
    if (!now) return Promise.resolve();
    const next = isBlankRichText(description) ? null : description.trim();
    if (next === (now.description ?? null)) return Promise.resolve();
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
