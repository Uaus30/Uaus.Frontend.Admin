import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGetTaskCardQueryKey, type TaskCardDto } from "@workspace/api-client-react";

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
  return { ...renderHook(() => useTaskCard(7), { wrapper }), queryClient };
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

const ETIQUETAS = [
  { id: 1, name: "Bug", color: "red", priority: "Urgent", createdAt: "2026-10-01T00:00:00" },
  { id: 2, name: "Ideia", color: "sky", priority: "Low", createdAt: "2026-10-01T00:00:00" },
];
const USUARIOS = [{ userId: 5, firstName: "Ana", fullName: "Ana Souza" }];

/** Um PUT que só responde quando o teste manda — o servidor "lento". */
function putsControlados() {
  const respostas: Array<() => void> = [];
  const recusas: Array<() => void> = [];
  mocks.updateTaskCard.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        respostas.push(() => resolve(card));
        recusas.push(() => reject(new Error("A descrição excede 20000 caracteres!")));
      }),
  );
  return {
    /** Recusa o PUT de número `indice`, como o servidor faz com texto longo demais. */
    recusar: async (indice: number) => {
      await waitFor(() => expect(recusas[indice]).toBeDefined());
      await act(async () => recusas[indice]());
    },
    /** Responde o PUT de número `indice` — depois de ele sair, que é assíncrono. */
    responder: async (indice: number) => {
      await waitFor(() => expect(respostas[indice]).toBeDefined());
      await act(async () => respostas[indice]());
    },
  };
}

/**
 * O defeito: cada PUT manda etiquetas e membros INTEIROS, montados do cartão em
 * cache. Marcar a etiqueta A e logo a B, antes de o cartão ser relido, mandava
 * o segundo PUT sem a A — e a A se perdia.
 */
describe("useTaskCard — gravações seguidas não se atropelam", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskCard.mockReturnValue({ data: card, isLoading: false, isError: false });
    mocks.useGetTaskLabels.mockReturnValue({ data: ETIQUETAS });
    mocks.useGetTaskBoardMembers.mockReturnValue({ data: USUARIOS });
  });

  it("duas etiquetas marcadas em seguida: o segundo PUT leva as duas", async () => {
    const servidor = putsControlados();
    const { result } = setup();

    act(() => result.current.toggleLabel(1));
    act(() => result.current.toggleLabel(2));

    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalledTimes(1));
    expect(mocks.updateTaskCard.mock.calls[0][1].labelIds).toEqual([1]);

    // Em fila: o segundo só sai depois da resposta do primeiro, e chega ao
    // servidor na ordem em que foi feito.
    await servidor.responder(0);
    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalledTimes(2));
    expect(mocks.updateTaskCard.mock.calls[1][1].labelIds).toEqual([1, 2]);
    await servidor.responder(1);
  });

  it("etiqueta seguida de membro: o PUT do membro não desfaz a etiqueta", async () => {
    const servidor = putsControlados();
    const { result } = setup();

    act(() => result.current.toggleLabel(1));
    act(() => result.current.toggleMember(5));

    await servidor.responder(0);
    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalledTimes(2));
    expect(mocks.updateTaskCard.mock.calls[1][1]).toMatchObject({ labelIds: [1], memberIds: [5] });
    await servidor.responder(1);
  });

  it("a marca aparece na hora, e o cartão só é relido depois do último PUT da fila", async () => {
    const servidor = putsControlados();
    const { result, queryClient } = setup();
    const releitura = vi.spyOn(queryClient, "invalidateQueries");

    act(() => result.current.toggleLabel(1));
    act(() => result.current.toggleLabel(2));

    const noCache = () =>
      queryClient
        .getQueryData<TaskCardDto>([...getGetTaskCardQueryKey(), { id: 7 }])
        ?.labels.map((l) => l.id);
    expect(noCache()).toEqual([1, 2]);

    // Reler aqui traria do servidor o cartão sem a B, e a marca sumiria.
    await servidor.responder(0);
    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalledTimes(2));
    expect(releitura).not.toHaveBeenCalled();

    await servidor.responder(1);
    await waitFor(() => expect(releitura).toHaveBeenCalledTimes(1));
  });

  // O campo de texto remonta quando a descrição do cartão muda (`key`). Pôr o
  // texto no cache antes da resposta fechava o editor na hora e, com a recusa,
  // o rascunho sumia.
  it("descrição recusada não entra no cartão nem vai de carona no PUT seguinte", async () => {
    const servidor = putsControlados();
    const { result, queryClient } = setup();
    const descricaoNoCache = () =>
      queryClient.getQueryData<TaskCardDto>([...getGetTaskCardQueryKey(), { id: 7 }])?.description;

    let gravacao: Promise<unknown> = Promise.resolve();
    act(() => {
      gravacao = result.current.saveDescription("<p>texto longo demais</p>");
    });
    act(() => result.current.toggleLabel(1));
    expect(descricaoNoCache()).not.toBe("<p>texto longo demais</p>");

    const recusa = expect(gravacao).rejects.toThrow();
    await servidor.recusar(0);
    await recusa;

    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalledTimes(2));
    expect(mocks.updateTaskCard.mock.calls[1][1]).toMatchObject({
      description: card.description,
      labelIds: [1],
    });
    await servidor.responder(1);
  });

  it("descrição aceita entra no cartão só depois da resposta", async () => {
    const servidor = putsControlados();
    const { result, queryClient } = setup();
    const descricaoNoCache = () =>
      queryClient.getQueryData<TaskCardDto>([...getGetTaskCardQueryKey(), { id: 7 }])?.description;

    act(() => result.current.toggleLabel(1));
    act(() => {
      void result.current.saveDescription("<p>Nova</p>");
    });
    expect(descricaoNoCache()).toBe(card.description);

    await servidor.responder(0);
    await servidor.responder(1);
    await waitFor(() => expect(descricaoNoCache()).toBe("<p>Nova</p>"));
    // O PUT da descrição levou a etiqueta marcada antes dele.
    expect(mocks.updateTaskCard.mock.calls[1][1]).toMatchObject({
      description: "<p>Nova</p>",
      labelIds: [1],
    });
  });

  it("desmarcar a que acabou de marcar volta ao cartão sem ela", async () => {
    const servidor = putsControlados();
    const { result } = setup();

    act(() => result.current.toggleLabel(1));
    act(() => result.current.toggleLabel(1));

    await servidor.responder(0);
    await waitFor(() => expect(mocks.updateTaskCard).toHaveBeenCalledTimes(2));
    expect(mocks.updateTaskCard.mock.calls[1][1].labelIds).toEqual([]);
    await servidor.responder(1);
  });
});
