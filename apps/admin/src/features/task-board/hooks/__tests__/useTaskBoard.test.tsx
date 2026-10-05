import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TASK_CARD_STATUS, type TaskBoardDto, type TaskCardSummaryDto } from "@workspace/api-client-react";
import { columnDropId } from "../../board";

const mocks = vi.hoisted(() => ({
  useGetTaskBoard: vi.fn(),
  moveTaskCard: vi.fn(),
  createTaskCard: vi.fn(),
  archiveTaskCard: vi.fn(),
  unarchiveTaskCard: vi.fn(),
  deleteTaskCard: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetTaskBoard: mocks.useGetTaskBoard,
  moveTaskCard: mocks.moveTaskCard,
  createTaskCard: mocks.createTaskCard,
  archiveTaskCard: mocks.archiveTaskCard,
  unarchiveTaskCard: mocks.unarchiveTaskCard,
  deleteTaskCard: mocks.deleteTaskCard,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useTaskBoard } = await import("../useTaskBoard");

function card(id: number, status: string, position: number): TaskCardSummaryDto {
  return {
    id,
    number: id,
    title: `Cartão ${id}`,
    status,
    position,
    isArchived: false,
    hasDescription: false,
    checklistTotal: 0,
    checklistDone: 0,
    attachmentsCount: 0,
    labels: [],
    members: [],
    createdAt: "2026-09-30T10:00:00",
  };
}

const board: TaskBoardDto = {
  items: [card(1, "Backlog", 1024), card(2, "Backlog", 2048), card(3, "Doing", 1024), card(4, "Done", 1024)],
  hiddenFinishedCount: 2,
  finishedWindowDays: 30,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/**
 * O que está sendo protegido: o arrasto grava UMA posição, calculada entre os
 * vizinhos da coluna de destino; a cópia local reage antes do servidor e volta
 * atrás se ele recusar; e a coluna Finalizado sabe quantos escondeu.
 */
describe("useTaskBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskBoard.mockReturnValue({ data: board, isLoading: false, isError: false, error: null });
    mocks.moveTaskCard.mockResolvedValue(null);
    mocks.createTaskCard.mockResolvedValue(null);
  });

  it("agrupa os cartões por coluna e expõe os finalizados ocultos", () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    expect(result.current.columns[TASK_CARD_STATUS.Backlog].map((c) => c.id)).toEqual([1, 2]);
    expect(result.current.columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([3]);
    expect(result.current.hiddenFinishedCount).toBe(2);
    expect(result.current.finishedWindowDays).toBe(30);
    expect(result.current.activeCard).toBeNull();
  });

  it("consulta o servidor com allFinished quando o usuário pede todos", () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    act(() => result.current.setAllFinished(true));

    expect(mocks.useGetTaskBoard).toHaveBeenLastCalledWith({ allFinished: true });
  });

  it("arrastar para outra coluna, sobre um cartão, grava a posição entre os vizinhos", async () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    // Pega o #1 (Backlog), passa por cima do #3 (Fazendo) e solta ali.
    act(() => result.current.beginDrag(1));
    act(() => result.current.dragOver(1, 3));

    // Ainda sem chamar o servidor: a cópia local já mostra o #1 antes do #3.
    expect(mocks.moveTaskCard).not.toHaveBeenCalled();
    expect(result.current.columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([1, 3]);
    expect(result.current.columns[TASK_CARD_STATUS.Backlog].map((c) => c.id)).toEqual([2]);

    // Solta com o ponteiro sobre o próprio cartão: fica onde a cópia local o pôs.
    act(() => result.current.endDrag(1, 1));

    // Antes do #3 (1024) e sem anterior: metade.
    await waitFor(() =>
      expect(mocks.moveTaskCard).toHaveBeenCalledWith(1, { status: TASK_CARD_STATUS.Doing, position: 512 }),
    );
    expect(result.current.activeCard).toBeNull();
    // A ordem local sobrevive até o servidor responder — não volta à antiga.
    expect(result.current.columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([1, 3]);
  });

  it("soltar sobre um vizinho abaixo vai para o lugar dele", async () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    act(() => result.current.beginDrag(1));
    act(() => result.current.dragOver(1, 3));
    // A cópia local tem [1, 3]; o ponteiro está sobre o #3, então o #1 vai para depois dele.
    act(() => result.current.endDrag(1, 3));

    await waitFor(() =>
      expect(mocks.moveTaskCard).toHaveBeenCalledWith(1, { status: TASK_CARD_STATUS.Doing, position: 2048 }),
    );
    expect(result.current.columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([3, 1]);
  });

  it("soltar sobre a coluna vazia (o alvo é a própria coluna) grava no fim dela", async () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    act(() => result.current.beginDrag(2));
    act(() => result.current.dragOver(2, columnDropId(TASK_CARD_STATUS.Testing)));
    act(() => result.current.endDrag(2, columnDropId(TASK_CARD_STATUS.Testing)));

    await waitFor(() =>
      expect(mocks.moveTaskCard).toHaveBeenCalledWith(2, {
        status: TASK_CARD_STATUS.Testing,
        position: 1024,
      }),
    );
  });

  it("reordenar dentro da mesma coluna grava a média dos vizinhos", async () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    // #2 (2048) vai para antes do #1 (1024): sem anterior, metade de 1024.
    act(() => result.current.beginDrag(2));
    act(() => result.current.endDrag(2, 1));

    await waitFor(() =>
      expect(mocks.moveTaskCard).toHaveBeenCalledWith(2, { status: TASK_CARD_STATUS.Backlog, position: 512 }),
    );
    expect(result.current.columns[TASK_CARD_STATUS.Backlog].map((c) => c.id)).toEqual([2, 1]);
  });

  it("soltar no mesmo lugar não chama o servidor", () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    act(() => result.current.beginDrag(1));
    act(() => result.current.endDrag(1, 1));

    expect(mocks.moveTaskCard).not.toHaveBeenCalled();
  });

  it("soltar fora de qualquer alvo volta ao que o servidor tem", () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    act(() => result.current.beginDrag(1));
    act(() => result.current.dragOver(1, 3));
    act(() => result.current.endDrag(1, null));

    expect(mocks.moveTaskCard).not.toHaveBeenCalled();
    expect(result.current.columns[TASK_CARD_STATUS.Backlog].map((c) => c.id)).toEqual([1, 2]);
    expect(result.current.columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([3]);
  });

  it("mover pelo select manda posição zero (fim da coluna) e recua se o servidor recusar", async () => {
    mocks.moveTaskCard.mockRejectedValueOnce(new Error("Cartão arquivado não pode ser movido"));
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.moveCardToColumn(3, TASK_CARD_STATUS.Done).catch(() => undefined);
    });

    expect(mocks.moveTaskCard).toHaveBeenCalledWith(3, { status: TASK_CARD_STATUS.Done, position: 0 });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    // A recusa desfaz a cópia local: o #3 continua em Fazendo.
    await waitFor(() => expect(result.current.columns[TASK_CARD_STATUS.Doing].map((c) => c.id)).toEqual([3]));
  });

  it("Finalizar tarefa leva para o fim de Finalizado e avisa", async () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.finishCard(3);
    });

    expect(mocks.moveTaskCard).toHaveBeenCalledWith(3, { status: TASK_CARD_STATUS.Done, position: 0 });
    expect(result.current.columns[TASK_CARD_STATUS.Done].map((c) => c.id)).toEqual([4, 3]);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Tarefa finalizada." }));
  });

  it("Finalizar tarefa recusado pelo servidor não estoura a promessa nem avisa sucesso", async () => {
    mocks.moveTaskCard.mockRejectedValueOnce(new Error("Cartão arquivado não pode ser movido"));
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.finishCard(3);
    });

    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(mocks.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Tarefa finalizada." }));
  });

  it("criar pelo rodapé da coluna usa a coluna certa e nenhum vínculo", async () => {
    const { result } = renderHook(() => useTaskBoard(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.createCard("Trocar a impressora", TASK_CARD_STATUS.Pending);
    });

    expect(mocks.createTaskCard).toHaveBeenCalledWith({
      title: "Trocar a impressora",
      status: TASK_CARD_STATUS.Pending,
      labelIds: [],
      memberIds: [],
    });
  });
});
