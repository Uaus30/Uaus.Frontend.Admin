import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTaskCard,
  deleteTaskCard,
  moveTaskCard,
  TASK_CARD_STATUS,
  TASK_CARDS_QUERY_KEY,
  useGetTaskBoard,
  useGetTaskBoardMembers,
  type TaskCardSummaryDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { useSessao } from "@/hooks/use-sessao";
import { countTasks, matchesWho, visibleTasks, type TaskView, type WhoFilter } from "../tasks";
import type { NewTaskInput } from "../types";
import { undoAction } from "../undo-action";
import { useTaskSearch } from "./useTaskSearch";

/**
 * Quanto o cartão concluído fica na tela, riscado e com o ✓ verde, antes de sair
 * da lista. Sem a pausa, ele sumiria no instante do clique e quem clicou não teria
 * certeza de que acertou o cartão — é o que o "Desfazer" do aviso conserta, mas
 * ver resolve antes.
 */
export const COMPLETE_FEEDBACK_MS = 450;

/**
 * Quanto o aviso com "Desfazer" fica na tela. O padrão do aviso de sucesso é 3 s —
 * no smoke de 23/10/2026 ele sumia antes de dar tempo de ler e achar o botão.
 */
export const UNDO_TOAST_MS = 8000;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * useTaskList
 *
 * Hook controlador da lista de tarefas (rota `/tarefas`, desde 23/10/2026 — antes
 * um quadro de colunas): carrega as pendentes e as finalizadas da janela numa
 * consulta só, e a tela filtra por situação e por pessoa sem nova ida ao servidor.
 *
 * - **Abre nas tarefas do usuário logado** ("minhas"), pedido do dono; o filtro
 *   mostra as de todos ou as de uma pessoa.
 * - **Com texto na busca, a lista vem do servidor** (`useTaskSearch`): ela acha
 *   também na solução, nos comentários e nas finalizadas fora da janela. Situação e
 *   pessoa continuam valendo sobre o resultado.
 * - **Concluir é um clique**, sem confirmação: o aviso traz "Desfazer", que reabre.
 *   É o que deixa o botão grande seguro — o engano custa um clique, não um
 *   diálogo a cada tarefa feita.
 */
export function useTaskList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me } = useSessao();
  const meId = me?.id ?? null;

  const [allFinished, setAllFinished] = useState(false);
  const { data, isLoading, isError, error } = useGetTaskBoard({ allFinished });
  const { data: users } = useGetTaskBoardMembers();
  const search = useTaskSearch();

  const [view, setView] = useState<TaskView>("pending");
  const [who, setWho] = useState<WhoFilter>("mine");
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [isNewOpen, setNewOpen] = useState(false);
  /** Tarefas concluídas que ainda mostram o ✓ antes de sair da lista. */
  const [completing, setCompleting] = useState<ReadonlySet<number>>(new Set());
  // O estado acima desenha; esta ref barra o segundo clique antes de o primeiro renderizar.
  const inFlight = useRef(new Set<number>());
  // A mesma guarda para "Nova tarefa": o segundo Enter antes de o diálogo fechar.
  const creatingRef = useRef(false);

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
    mutationFn: (input: {
      id: number;
      status: typeof TASK_CARD_STATUS.Pending | typeof TASK_CARD_STATUS.Done;
    }) => moveTaskCard(input.id, { status: input.status, position: 0 }),
  });

  const createMutation = useMutation({
    mutationFn: (input: NewTaskInput) => createTaskCard({ ...input, labelIds: [] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTaskCard(id),
    onSuccess: async () => {
      await invalidate();
      setSelectedCardId(null);
      toast({ title: "Tarefa excluída." });
    },
    onError: (err: unknown) => failToast("Erro ao excluir a tarefa", err),
  });

  const items = useMemo(() => data?.items ?? [], [data]);

  function setDone(id: number, done: boolean) {
    if (done) inFlight.current.add(id);
    else inFlight.current.delete(id);
    setCompleting((current) => {
      const next = new Set(current);
      if (done) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Reabre: volta para as pendentes. O aviso oferece concluir de novo. */
  async function reopen(card: Pick<TaskCardSummaryDto, "id" | "number">) {
    try {
      await moveMutation.mutateAsync({ id: card.id, status: TASK_CARD_STATUS.Pending });
      await invalidate();
      toast({
        title: `Tarefa #${card.number} reaberta.`,
        description: "Voltou para as pendentes.",
        duration: UNDO_TOAST_MS,
        action: undoAction("Concluir de novo", () => void complete(card, { feedback: false })),
      });
    } catch (err) {
      failToast("Erro ao reabrir a tarefa", err);
    }
  }

  /**
   * Conclui: o cartão mostra o ✓ por um instante e sai da lista. Falhou, ele volta
   * ao normal e o aviso diz por quê.
   */
  async function complete(card: Pick<TaskCardSummaryDto, "id" | "number">, options = { feedback: true }) {
    if (inFlight.current.has(card.id)) return;
    setDone(card.id, true);
    try {
      await Promise.all([
        moveMutation.mutateAsync({ id: card.id, status: TASK_CARD_STATUS.Done }),
        options.feedback ? pause(COMPLETE_FEEDBACK_MS) : Promise.resolve(),
      ]);
      await invalidate();
      toast({
        title: `Tarefa #${card.number} concluída.`,
        duration: UNDO_TOAST_MS,
        action: undoAction("Reabrir a tarefa", () => void reopen(card)),
      });
    } catch (err) {
      failToast("Erro ao concluir a tarefa", err);
    } finally {
      setDone(card.id, false);
    }
  }

  /**
   * Cria e diz para quem foi. Se a tarefa nasceu para outra pessoa e a tela está em
   * "minhas", ela não aparece aqui — o aviso diz onde procurar, senão parece que
   * não gravou.
   *
   * O diálogo fecha assim que o servidor grava, ANTES de reler a lista. Fechando
   * depois, o botão voltava a "Salvar tarefa" durante a releitura (até meio segundo
   * no 4G) com o texto ainda no formulário — parecia que não tinha gravado, e o
   * segundo Enter criava a mesma tarefa de novo (achado da revisão de 23/10/2026).
   */
  async function createTask(input: NewTaskInput) {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const created = await createMutation.mutateAsync(input);
      setNewOpen(false);
      setView("pending");
      const assignee = users?.find((u) => u.userId === input.assigneeId);
      const forWhom =
        input.assigneeId === meId ? "para você" : `para ${assignee?.firstName ?? "a pessoa escolhida"}`;
      const shown = created === null || matchesWho(created, who, meId);
      toast({
        title: `Tarefa${created ? ` #${created.number}` : ""} anotada ${forWhom}.`,
        description: shown ? undefined : 'Ela aparece em "Todas as pessoas".',
      });
    } catch (err) {
      failToast("Erro ao criar a tarefa", err);
      throw err;
    } finally {
      creatingRef.current = false;
    }
    await invalidate();
  }

  const source = search.isActive ? search.results : items;
  const visible = useMemo(() => visibleTasks(source, view, who, meId), [source, view, who, meId]);

  return {
    isLoading,
    isError,
    error,
    meId,
    users: users ?? [],

    view,
    setView,
    who,
    setWho,
    search,
    visible,
    /** As contagens das duas abas: da lista (a busca não mexe nelas). */
    pendingCount: countTasks(items, "pending", who, meId),
    doneCount: countTasks(items, "done", who, meId),
    /** Quantas pendentes (ou finalizadas) cada filtro de pessoa tem, para o seletor. */
    countFor: (filter: WhoFilter) => countTasks(items, view, filter, meId),
    hiddenFinishedCount: data?.hiddenFinishedCount ?? 0,
    finishedWindowDays: data?.finishedWindowDays ?? 30,
    allFinished,
    showAllFinished: () => setAllFinished(true),

    completing,
    complete: (card: TaskCardSummaryDto) => complete(card),
    reopen: (card: Pick<TaskCardSummaryDto, "id" | "number">) => reopen(card),
    isMoving: moveMutation.isPending,

    // Detalhe
    selectedCardId,
    openCard: setSelectedCardId,
    closeCard: () => setSelectedCardId(null),
    deleteCard: (id: number) => deleteMutation.mutateAsync(id),
    isDeleting: deleteMutation.isPending,

    // Nova tarefa
    isNewOpen,
    openNew: () => setNewOpen(true),
    closeNew: () => setNewOpen(false),
    createTask,
    isCreating: createMutation.isPending,
  };
}

export type TaskListController = ReturnType<typeof useTaskList>;
