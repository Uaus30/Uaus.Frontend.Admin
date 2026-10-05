import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TASK_CARDS_QUERY_KEY, type TaskCardActivityDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetTaskCardActivities: vi.fn(),
  useGetMe: vi.fn(),
  addTaskCardComment: vi.fn(),
  updateTaskCardComment: vi.fn(),
  deleteTaskCardComment: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetTaskCardActivities: mocks.useGetTaskCardActivities,
  useGetMe: mocks.useGetMe,
  addTaskCardComment: mocks.addTaskCardComment,
  updateTaskCardComment: mocks.updateTaskCardComment,
  deleteTaskCardComment: mocks.deleteTaskCardComment,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useCardActivity } = await import("../useCardActivity");

const rows: TaskCardActivityDto[] = [
  { id: 1, kind: "Created", author: "Ana", userId: 3, createdAt: "2026-10-05T10:00:00" },
];

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useCardActivity(7), { wrapper });
  return { ...hook, invalidate };
}

/**
 * O que está sendo protegido: as ações de comentário vão para o cartão certo,
 * toda ação invalida o prefixo dos cartões (é isso que traz a linha nova e o
 * "Atualizado em"), a falha vira aviso, e o id da sessão chega à tela.
 */
describe("useCardActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskCardActivities.mockReturnValue({ data: rows, isLoading: false, isError: false });
    mocks.useGetMe.mockReturnValue({ data: { id: 3 } });
    mocks.addTaskCardComment.mockResolvedValue(null);
    mocks.updateTaskCardComment.mockResolvedValue(null);
    mocks.deleteTaskCardComment.mockResolvedValue(undefined);
  });

  it("entrega a linha do tempo do cartão e quem está na sessão", () => {
    const { result } = setup();

    expect(mocks.useGetTaskCardActivities).toHaveBeenCalledWith(7);
    expect(result.current.activities).toEqual(rows);
    expect(result.current.currentUserId).toBe(3);
  });

  it("sem sessão carregada, ninguém é autor", () => {
    mocks.useGetMe.mockReturnValue({ data: undefined });
    const { result } = setup();

    expect(result.current.currentUserId).toBeNull();
  });

  it("comentar, editar e excluir vão para o cartão certo e atualizam os cartões", async () => {
    const { result, invalidate } = setup();

    await act(async () => {
      await result.current.addComment("<p>oi</p>");
      await result.current.updateComment(40, "<p>corrigido</p>");
      await result.current.deleteComment(40);
    });

    expect(mocks.addTaskCardComment).toHaveBeenCalledWith(7, { text: "<p>oi</p>" });
    expect(mocks.updateTaskCardComment).toHaveBeenCalledWith(7, 40, { text: "<p>corrigido</p>" });
    expect(mocks.deleteTaskCardComment).toHaveBeenCalledWith(7, 40);
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: TASK_CARDS_QUERY_KEY });
  });

  it("falha ao comentar avisa e devolve o erro para a caixa manter o rascunho", async () => {
    mocks.addTaskCardComment.mockRejectedValueOnce(new Error("Escreva o comentário!"));
    const { result } = setup();

    await act(async () => {
      await expect(result.current.addComment("<p></p>")).rejects.toThrow();
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao comentar", variant: "destructive" }),
    );
  });
});
