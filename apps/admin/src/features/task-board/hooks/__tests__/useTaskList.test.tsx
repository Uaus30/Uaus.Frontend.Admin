import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskBoardDto, TaskCardSummaryDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetTaskBoard: vi.fn(),
  useGetTaskBoardMembers: vi.fn(),
  useSearchTaskCards: vi.fn(),
  useGetMe: vi.fn(),
  moveTaskCard: vi.fn(),
  createTaskCard: vi.fn(),
  deleteTaskCard: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetTaskBoard: mocks.useGetTaskBoard,
  useGetTaskBoardMembers: mocks.useGetTaskBoardMembers,
  useSearchTaskCards: mocks.useSearchTaskCards,
  useGetMe: mocks.useGetMe,
  moveTaskCard: mocks.moveTaskCard,
  createTaskCard: mocks.createTaskCard,
  deleteTaskCard: mocks.deleteTaskCard,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useTaskList } = await import("../useTaskList");

const ANA = { userId: 3, firstName: "Ana", fullName: "Ana Souza" };
const BRUNO = { userId: 9, firstName: "Bruno", fullName: "Bruno Lima" };

function task(overrides: Partial<TaskCardSummaryDto>): TaskCardSummaryDto {
  return {
    id: 1,
    number: 1,
    title: "Tarefa",
    status: "Pending",
    priority: "Normal",
    hasDescription: false,
    attachmentsCount: 0,
    labels: [],
    assignee: ANA,
    createdAt: "2026-10-20T10:00:00",
    ...overrides,
  };
}

const board: TaskBoardDto = {
  items: [
    task({ id: 1, number: 101, title: "Normal da Ana" }),
    task({ id: 2, number: 102, title: "Urgente da Ana", priority: "Urgent" }),
    task({ id: 3, number: 103, title: "Do Bruno", assignee: BRUNO }),
    task({
      id: 4,
      number: 104,
      title: "Finalizada da Ana",
      status: "Done",
      finishedAt: "2026-10-22T10:00:00",
    }),
  ],
  hiddenFinishedCount: 0,
  finishedWindowDays: 30,
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useTaskList(), { wrapper }), queryClient };
}

/** O botão "Desfazer" que o último aviso trouxe. */
function lastUndo(): () => void {
  const call = mocks.toast.mock.calls.at(-1)?.[0] as { action?: React.ReactElement<{ onClick: () => void }> };
  if (!call?.action) throw new Error("o aviso não trouxe Desfazer");
  return call.action.props.onClick;
}

/**
 * O que está sendo protegido: a tela abre nas pendentes de quem está logado, da
 * mais urgente para a menos; concluir é um clique, com o ✓ por um instante e o
 * "Desfazer" no aviso; o clique repetido não conclui duas vezes; e a tarefa criada
 * para outra pessoa avisa onde aparece.
 */
describe("useTaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskBoard.mockReturnValue({ data: board, isLoading: false, isError: false, error: null });
    mocks.useGetTaskBoardMembers.mockReturnValue({ data: [ANA, BRUNO] });
    mocks.useSearchTaskCards.mockReturnValue({ data: [], isFetching: false });
    mocks.useGetMe.mockReturnValue({ data: { id: 3, firstName: "Ana", lastName: "Souza" } });
    mocks.moveTaskCard.mockResolvedValue(null);
  });

  it("abre nas minhas pendentes, da mais urgente para a menos; Todas mostra as dos outros", () => {
    const { result } = setup();

    expect(result.current.who).toBe("mine");
    expect(result.current.visible.map((t) => t.id)).toEqual([2, 1]);
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.doneCount).toBe(1);

    act(() => result.current.setWho("all"));
    expect(result.current.visible.map((t) => t.id)).toEqual([2, 1, 3]);
    expect(result.current.countFor(BRUNO.userId)).toBe(1);

    act(() => result.current.setView("done"));
    expect(result.current.visible.map((t) => t.id)).toEqual([4]);
  });

  it("concluir marca o cartão, grava Finalizado e o aviso traz Desfazer, que reabre", async () => {
    const { result } = setup();
    const card = board.items[1];

    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.complete(card);
    });
    expect(result.current.completing.has(card.id)).toBe(true);
    await waitFor(() => expect(mocks.moveTaskCard).toHaveBeenCalledWith(card.id, { status: 5, position: 0 }));
    // O ✓ fica na tela pela pausa inteira, mesmo com o servidor já tendo respondido.
    expect(result.current.completing.has(card.id)).toBe(true);

    await act(async () => {
      await done;
    });
    expect(result.current.completing.has(card.id)).toBe(false);
    // O "Desfazer" precisa de tempo para ser achado: o aviso de sucesso padrão some em 3 s.
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Tarefa #102 concluída.", duration: 8000 }),
    );

    act(() => lastUndo()());
    await waitFor(() =>
      expect(mocks.moveTaskCard).toHaveBeenLastCalledWith(card.id, { status: 2, position: 0 }),
    );
  });

  it("dois cliques no mesmo cartão concluem uma vez só", async () => {
    const { result } = setup();
    const card = board.items[0];

    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.complete(card);
      void result.current.complete(card);
    });
    await act(async () => {
      await first;
    });

    expect(mocks.moveTaskCard).toHaveBeenCalledTimes(1);
  });

  it("concluir recusado avisa e o cartão volta ao normal", async () => {
    mocks.moveTaskCard.mockRejectedValueOnce(new Error("Sem conexão"));
    const { result } = setup();

    await act(async () => {
      await result.current.complete(board.items[0]);
    });

    expect(result.current.completing.size).toBe(0);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao concluir a tarefa", variant: "destructive" }),
    );
  });

  it("tarefa criada para outra pessoa, vista em Minhas, diz onde aparece", async () => {
    mocks.createTaskCard.mockResolvedValue({
      ...task({ id: 9, number: 112 }),
      assignee: BRUNO,
      attachments: [],
    });
    const { result } = setup();

    await act(async () => {
      await result.current.createTask({
        title: "Trocar a bobina",
        description: null,
        priority: 4,
        assigneeId: 9,
      });
    });

    expect(mocks.createTaskCard).toHaveBeenCalledWith({
      title: "Trocar a bobina",
      description: null,
      priority: 4,
      assigneeId: 9,
      labelIds: [],
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Tarefa #112 anotada para Bruno.",
      description: 'Ela aparece em "Todas as pessoas".',
    });
  });

  // Achado da revisão de 23/10/2026: o diálogo só fechava depois de reler a lista,
  // e nesse meio o botão voltava a "Salvar tarefa" — o segundo Enter criava outra.
  it("Nova tarefa fecha assim que grava, antes de reler a lista, e o segundo envio não cria outra", async () => {
    mocks.createTaskCard.mockResolvedValue({ ...task({ id: 9, number: 113 }), attachments: [] });
    const { result, queryClient } = setup();
    // A releitura que não termina: o 4G lento.
    vi.spyOn(queryClient, "invalidateQueries").mockReturnValue(new Promise(() => {}));
    act(() => result.current.openNew());
    const input = { title: "Repor as sacolas", description: null, priority: 2 as const, assigneeId: 3 };

    act(() => {
      void result.current.createTask(input);
      void result.current.createTask(input);
    });

    await waitFor(() => expect(result.current.isNewOpen).toBe(false));
    expect(mocks.createTaskCard).toHaveBeenCalledTimes(1);
  });

  it("com texto na busca, a lista vem do servidor, com a aba e a pessoa valendo", async () => {
    mocks.useSearchTaskCards.mockReturnValue({
      data: [
        task({
          id: 50,
          number: 50,
          title: "Antiga da Ana",
          status: "Done",
          finishedAt: "2026-06-01T10:00:00",
        }),
        task({ id: 51, number: 51, title: "Pendente do Bruno", assignee: BRUNO }),
      ],
      isFetching: false,
    });
    const { result } = setup();

    act(() => result.current.search.setInput("antiga"));
    act(() => result.current.setView("done"));

    expect(result.current.visible.map((t) => t.id)).toEqual([50]);
    // As abas continuam contando a lista, não o resultado da busca.
    expect(result.current.doneCount).toBe(1);
  });
});
