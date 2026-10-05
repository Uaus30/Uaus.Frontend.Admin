import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskCardDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetTaskCard: vi.fn(),
  useGetTaskLabels: vi.fn(),
  useGetTaskBoardMembers: vi.fn(),
  updateTaskCard: vi.fn(),
  saveTaskCardSolution: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetTaskCard: mocks.useGetTaskCard,
  useGetTaskLabels: mocks.useGetTaskLabels,
  useGetTaskBoardMembers: mocks.useGetTaskBoardMembers,
  updateTaskCard: mocks.updateTaskCard,
  saveTaskCardSolution: mocks.saveTaskCardSolution,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useTaskCard } = await import("../useTaskCard");

const card: TaskCardDto = {
  id: 7,
  number: 37,
  title: "Impressora",
  description: "Texto antigo, sem formatação",
  solution: "<p>Troquei o cabo</p>",
  status: "Testing",
  position: 1024,
  isArchived: false,
  labels: [],
  members: [],
  checklistItems: [],
  attachments: [],
  createdAt: "2026-10-01T10:00:00",
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTaskCard(7), { wrapper });
}

/**
 * O que está sendo protegido: a solução vai pela rota própria (nunca no PUT do
 * cartão, que a apagaria num admin antigo); o editor vazio vira "sem texto";
 * nada é gravado quando nada mudou — menos o "Salvar e finalizar", que finaliza
 * mesmo com a solução igual.
 */
describe("useTaskCard — descrição e solução", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskCard.mockReturnValue({ data: card, isLoading: false, isError: false });
    mocks.useGetTaskLabels.mockReturnValue({ data: [] });
    mocks.useGetTaskBoardMembers.mockReturnValue({ data: [] });
    mocks.updateTaskCard.mockResolvedValue(card);
    mocks.saveTaskCardSolution.mockResolvedValue(card);
  });

  it("salvar a solução usa a rota própria, sem finalizar", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.saveSolution("<p>Troquei o cabo e a fonte</p>");
    });

    await waitFor(() =>
      expect(mocks.saveTaskCardSolution).toHaveBeenCalledWith(7, {
        solution: "<p>Troquei o cabo e a fonte</p>",
        finish: false,
      }),
    );
    expect(mocks.updateTaskCard).not.toHaveBeenCalled();
  });

  it("solução igual não grava; com finalizar, grava e finaliza", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.saveSolution("<p>Troquei o cabo</p>");
    });
    expect(mocks.saveTaskCardSolution).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.saveSolution("<p>Troquei o cabo</p>", true);
    });
    await waitFor(() =>
      expect(mocks.saveTaskCardSolution).toHaveBeenCalledWith(7, {
        solution: "<p>Troquei o cabo</p>",
        finish: true,
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({ title: "Solução salva e tarefa #37 finalizada." }),
    );
  });

  it("editor vazio apaga a solução e a descrição (manda nulo, não <p></p>)", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.saveSolution("<p></p>");
    });
    await waitFor(() =>
      expect(mocks.saveTaskCardSolution).toHaveBeenCalledWith(7, { solution: null, finish: false }),
    );

    await act(async () => {
      await result.current.saveDescription("");
    });
    await waitFor(() =>
      expect(mocks.updateTaskCard).toHaveBeenCalledWith(7, expect.objectContaining({ description: null })),
    );
  });

  it("gravação recusada rejeita a promessa (o campo mantém o rascunho) e avisa", async () => {
    mocks.saveTaskCardSolution.mockRejectedValueOnce(new Error("A solução excede 20000 caracteres!"));
    const { result } = setup();

    await act(async () => {
      await expect(result.current.saveSolution("<p>muito longa</p>", true)).rejects.toThrow();
    });

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao salvar a solução", variant: "destructive" }),
    );
  });

  it("o PUT do cartão não leva a solução", async () => {
    const { result } = setup();

    act(() => result.current.saveTitle("Impressora térmica"));

    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalled());
    expect(mocks.updateTaskCard.mock.calls[0][1]).not.toHaveProperty("solution");
  });
});
