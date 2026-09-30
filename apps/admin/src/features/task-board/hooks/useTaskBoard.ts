import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  archiveTaskCard,
  createTaskCard,
  deleteTaskCard,
  moveTaskCard,
  TASK_CARDS_QUERY_KEY,
  unarchiveTaskCard,
  useGetTaskBoard,
  type TaskCardStatusCode,
  type TaskCardSummaryDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  emptyColumns,
  findColumnOf,
  groupByColumn,
  parseColumnDropId,
  positionBetween,
  statusCode,
  type ColumnsMap,
} from "../board";
import type { MoveCardInput } from "../types";

/**
 * useTaskBoard
 *
 * Hook controlador do quadro: carrega os cartões, mantém uma cópia local por
 * coluna (é nela que o arrasto mexe antes de o servidor responder), e expõe as
 * ações de mover, criar, arquivar, desarquivar e excluir.
 *
 * A cópia local existe porque o arrasto precisa reagir a cada `dragOver` —
 * esperar o servidor a cada movimento do mouse deixaria o cartão "pulando". Ela
 * é ressincronizada com o servidor sempre que a consulta muda e NÃO há arrasto
 * em andamento; com arrasto em andamento, a resposta do servidor espera.
 */
export function useTaskBoard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [allFinished, setAllFinished] = useState(false);
  const { data, isLoading, isError, error } = useGetTaskBoard({ allFinished });

  const [columns, setColumns] = useState<ColumnsMap>(emptyColumns);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);

  // Ref, e não o estado, de propósito: o efeito só pode rodar quando os DADOS
  // mudam. Se dependesse de `activeCardId`, soltar o cartão (que zera o id)
  // dispararia a sincronização com a resposta ANTIGA do servidor e a coluna
  // voltaria à ordem anterior por um instante, até o refetch — a tela "piscava".
  const draggingRef = useRef(false);

  useEffect(() => {
    if (data && !draggingRef.current) setColumns(groupByColumn(data.items));
  }, [data]);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: TASK_CARDS_QUERY_KEY }),
    [queryClient],
  );

  const failToast = useCallback(
    (title: string, err: unknown) =>
      toast({ title, description: describeApiError(err), error: err, variant: "destructive" }),
    [toast],
  );

  const moveMutation = useMutation({
    mutationFn: (input: MoveCardInput) =>
      moveTaskCard(input.cardId, { status: input.status, position: input.position }),
    onSuccess: invalidate,
    // A cópia local já mostrou o cartão no destino; o servidor recusou (cartão
    // arquivado por outra pessoa, por exemplo). Volta para o que o servidor tem.
    onError: async (err: unknown) => {
      failToast("Não foi possível mover o cartão", err);
      await invalidate();
      if (data) setColumns(groupByColumn(data.items));
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: { title: string; status: TaskCardStatusCode }) =>
      createTaskCard({ title: input.title, status: input.status, labelIds: [], memberIds: [] }),
    onSuccess: invalidate,
    onError: (err: unknown) => failToast("Erro ao criar o cartão", err),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => archiveTaskCard(id),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Cartão arquivado.", description: "Ele continua na busca e na lista de arquivados." });
    },
    onError: (err: unknown) => failToast("Erro ao arquivar o cartão", err),
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: number) => unarchiveTaskCard(id),
    onSuccess: async () => {
      await invalidate();
      toast({
        title: "Cartão desarquivado.",
        description:
          'Voltou para a coluna em que estava. Se era um finalizado antigo, aparece em "Mostrar todos".',
      });
    },
    onError: (err: unknown) => failToast("Erro ao desarquivar o cartão", err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaskCard(id),
    onSuccess: async () => {
      await invalidate();
      setSelectedCardId(null);
      toast({ title: "Cartão excluído." });
    },
    onError: (err: unknown) => failToast("Erro ao excluir o cartão", err),
  });

  /**
   * Move um cartão para uma coluna, no fim dela (posição zero: o servidor
   * calcula). É o caminho do select da modal e do celular sem arrasto.
   */
  function moveCardToColumn(cardId: number, status: TaskCardStatusCode) {
    setColumns((current) => {
      const from = findColumnOf(current, cardId);
      if (from === undefined || from === status) return current;
      const card = current[from].find((c) => c.id === cardId)!;
      return {
        ...current,
        [from]: current[from].filter((c) => c.id !== cardId),
        [status]: [...current[status], { ...card, status }],
      };
    });
    return moveMutation.mutateAsync({ cardId, status, position: 0 });
  }

  /**
   * Início do arrasto: congela a sincronização com o servidor até soltar.
   */
  function beginDrag(cardId: number) {
    draggingRef.current = true;
    setActiveCardId(cardId);
  }

  /**
   * Durante o arrasto, ao passar sobre outra coluna ou sobre um cartão de outra
   * coluna: transfere o cartão na cópia local, na posição do alvo. Só a cópia
   * local muda — o servidor só é chamado ao soltar. `overId` é o id do cartão
   * ou o id de soltura da coluna (`columnDropId`).
   */
  function dragOver(cardId: number, overId: string | number) {
    setColumns((current) => {
      const from = findColumnOf(current, cardId);
      const overColumn = parseColumnDropId(overId) ?? findColumnOf(current, Number(overId));
      if (from === undefined || overColumn === undefined || from === overColumn) return current;

      const card = current[from].find((c) => c.id === cardId)!;
      const target = current[overColumn];
      const overIndex = target.findIndex((c) => c.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : target.length;

      const nextTarget = [...target];
      nextTarget.splice(insertAt, 0, { ...card, status: overColumn });

      return { ...current, [from]: current[from].filter((c) => c.id !== cardId), [overColumn]: nextTarget };
    });
  }

  /**
   * Soltou: reordena dentro da coluna de destino (o `dragOver` já trouxe o
   * cartão para ela), calcula a posição entre os vizinhos e grava. Sem alvo,
   * volta para o que o servidor tem.
   *
   * `overId` é o que está sob o ponteiro NO INSTANTE de soltar, na ordem já
   * rearranjada: o próprio cartão (fica onde a cópia local o pôs) ou um vizinho
   * (vai para o lugar dele — `arrayMove` do dnd-kit).
   */
  function endDrag(cardId: number, overId: string | number | null) {
    draggingRef.current = false;
    setActiveCardId(null);

    const column = findColumnOf(columns, cardId);
    if (overId == null || column === undefined) {
      if (data) setColumns(groupByColumn(data.items));
      return;
    }

    const list = [...columns[column]];
    const fromIndex = list.findIndex((c) => c.id === cardId);
    const overIndex = list.findIndex((c) => c.id === overId);
    const toIndex = overIndex >= 0 ? overIndex : list.length - 1;

    // Soltou onde já estava, na mesma coluna: nada a gravar. Sem esta guarda, a
    // média dos vizinhos quase nunca é igual à posição original e cada clique
    // "arrastado" viraria um PUT inútil.
    const original = data?.items.find((c) => c.id === cardId);
    if (original !== undefined && statusCode(original.status) === column && fromIndex === toIndex) return;

    const [card] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, card);

    const position = positionBetween(list[toIndex - 1]?.position, list[toIndex + 1]?.position);

    list[toIndex] = { ...card, position, status: column };
    setColumns((current) => ({ ...current, [column]: list }));
    moveMutation.mutate({ cardId, status: column, position });
  }

  function cancelDrag() {
    draggingRef.current = false;
    setActiveCardId(null);
    if (data) setColumns(groupByColumn(data.items));
  }

  const activeCard: TaskCardSummaryDto | null =
    activeCardId === null
      ? null
      : (Object.values(columns)
          .flat()
          .find((c) => c.id === activeCardId) ?? null);

  return {
    columns,
    isLoading,
    isError,
    error,
    hiddenFinishedCount: data?.hiddenFinishedCount ?? 0,
    finishedWindowDays: data?.finishedWindowDays ?? 30,
    allFinished,
    setAllFinished,

    // Arrasto
    activeCard,
    beginDrag,
    dragOver,
    endDrag,
    cancelDrag,
    moveCardToColumn,
    isMoving: moveMutation.isPending,

    // Modal de detalhe
    selectedCardId,
    openCard: setSelectedCardId,
    closeCard: () => setSelectedCardId(null),

    // Ações
    createCard: (title: string, status: TaskCardStatusCode) => createMutation.mutateAsync({ title, status }),
    isCreating: createMutation.isPending,
    archiveCard: (id: number) => archiveMutation.mutateAsync(id),
    unarchiveCard: (id: number) => unarchiveMutation.mutateAsync(id),
    deleteCard: (id: number) => deleteMutation.mutateAsync(id),
    isArchiving: archiveMutation.isPending || unarchiveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export type TaskBoardController = ReturnType<typeof useTaskBoard>;
