import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@workspace/ui";
// O editor é montado nesta página: o jsdom precisa das medidas de seleção.
import "@/components/rich-text/__tests__/jsdom-layout";
import type {
  TaskBoardDto,
  TaskCardActivityDto,
  TaskCardDto,
  TaskCardSummaryDto,
} from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetTaskBoard: vi.fn(),
  useGetTaskCard: vi.fn(),
  useGetTaskLabels: vi.fn(),
  useGetTaskBoardMembers: vi.fn(),
  useGetArchivedTaskCards: vi.fn(),
  useSearchTaskCards: vi.fn(),
  createTaskCard: vi.fn(),
  moveTaskCard: vi.fn(),
  saveTaskCardSolution: vi.fn(),
  useGetTaskCardActivities: vi.fn(),
  useGetMe: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetTaskBoard: mocks.useGetTaskBoard,
  useGetTaskCard: mocks.useGetTaskCard,
  useGetTaskLabels: mocks.useGetTaskLabels,
  useGetTaskBoardMembers: mocks.useGetTaskBoardMembers,
  useGetArchivedTaskCards: mocks.useGetArchivedTaskCards,
  useSearchTaskCards: mocks.useSearchTaskCards,
  createTaskCard: mocks.createTaskCard,
  moveTaskCard: mocks.moveTaskCard,
  saveTaskCardSolution: mocks.saveTaskCardSolution,
  useGetTaskCardActivities: mocks.useGetTaskCardActivities,
  useGetMe: mocks.useGetMe,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { default: TaskBoardPage } = await import("@/pages/task-board");

const summary: TaskCardSummaryDto = {
  id: 7,
  number: 7,
  title: "Trocar a impressora do caixa",
  status: "Doing",
  position: 1024,
  isArchived: false,
  hasDescription: true,
  checklistTotal: 2,
  checklistDone: 1,
  attachmentsCount: 1,
  labels: [{ id: 1, name: "Bug", color: "red", priority: "Urgent", createdAt: "2026-09-30T10:00:00" }],
  members: [{ userId: 3, firstName: "Ana", fullName: "Ana Souza" }],
  createdAt: "2026-09-30T10:00:00",
};

const detail: TaskCardDto = {
  ...summary,
  description: "A impressora térmica parou de cortar o cupom.",
  checklistItems: [
    { id: 1, text: "Testar cabo", isDone: true, position: 1 },
    { id: 2, text: "Trocar a bobina", isDone: false, position: 2 },
  ],
  attachments: [
    {
      id: 1,
      fileName: "foto.jpg",
      contentType: "image/jpeg",
      size: 2048,
      url: "https://bucket/foto.jpg",
      createdAt: "2026-09-30T10:00:00",
      createdBy: "Ana",
    },
  ],
  createdBy: "Ana",
};

const board: TaskBoardDto = { items: [summary], hiddenFinishedCount: 3, finishedWindowDays: 30 };

/** A sessão é a Ana (id 3): só o comentário dela mostra "Editar". */
const activities: TaskCardActivityDto[] = [
  {
    id: 1,
    kind: "Created",
    toStatus: "Backlog",
    author: "Ana Souza",
    userId: 3,
    createdAt: "2026-09-30T10:00:00",
  },
  {
    id: 2,
    kind: "Moved",
    fromStatus: "Backlog",
    toStatus: "Doing",
    author: "Bruno Lima",
    userId: 9,
    createdAt: "2026-09-30T11:00:00",
  },
  {
    id: 3,
    kind: "Comment",
    text: "<p>Liguei para o <strong>técnico</strong></p>",
    author: "Bruno Lima",
    userId: 9,
    createdAt: "2026-09-30T12:00:00",
  },
  {
    id: 4,
    kind: "Comment",
    text: "<p>Ele vem amanhã</p>",
    author: "Ana Souza",
    userId: 3,
    createdAt: "2026-09-30T13:00:00",
    updatedAt: "2026-09-30T13:05:00",
  },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TaskBoardPage />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

/**
 * Smoke de montagem: a página inteira (quadro, dnd-kit, busca, modal) renderiza
 * em jsdom sem erro e a interação básica funciona. Não substitui o smoke no
 * navegador; pega o que o typecheck não pega — import quebrado, hook fora de
 * provider, componente que explode ao montar.
 */
describe("TaskBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskBoard.mockReturnValue({ data: board, isLoading: false, isError: false, error: null });
    mocks.useGetTaskCard.mockReturnValue({ data: detail, isLoading: false, isError: false });
    mocks.useGetTaskLabels.mockReturnValue({ data: summary.labels, isLoading: false });
    mocks.useGetTaskBoardMembers.mockReturnValue({ data: summary.members });
    mocks.useGetArchivedTaskCards.mockReturnValue({ data: [], isLoading: false });
    mocks.useSearchTaskCards.mockReturnValue({ data: [], isFetching: false });
    mocks.useGetTaskCardActivities.mockReturnValue({ data: activities, isLoading: false, isError: false });
    mocks.useGetMe.mockReturnValue({ data: { id: 3, firstName: "Ana", lastName: "Souza" } });
    mocks.moveTaskCard.mockResolvedValue(null);
    mocks.saveTaskCardSolution.mockResolvedValue(null);
  });

  it("desenha as cinco colunas, o cartão e o link dos finalizados ocultos", () => {
    renderPage();

    for (const title of ["Backlog", "Pendente", "Fazendo", "Testes", "Finalizado"]) {
      expect(screen.getByRole("region", { name: title })).toBeTruthy();
    }
    expect(screen.getByText("Trocar a impressora do caixa")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
    expect(screen.getByText("Bug")).toBeTruthy();
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText(/Mostrar todos \(3 ocultos há mais de 30 dias\)/)).toBeTruthy();
  });

  it("clicar no cartão abre a modal com descrição, checklist e anexo", async () => {
    renderPage();

    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    await waitFor(() => expect(screen.getByLabelText("Título do cartão")).toBeTruthy());
    expect((screen.getByLabelText("Título do cartão") as HTMLInputElement).value).toBe(
      "Trocar a impressora do caixa",
    );
    expect(screen.getByText("A impressora térmica parou de cortar o cupom.")).toBeTruthy();
    expect(screen.getByText("Trocar a bobina")).toBeTruthy();
    expect(screen.getByText("foto.jpg")).toBeTruthy();
    expect(mocks.useGetTaskCard).toHaveBeenLastCalledWith(7);
  });

  it("o rodapé da coluna cria o cartão na coluna certa", async () => {
    mocks.createTaskCard.mockResolvedValue(null);
    renderPage();

    const pendente = screen.getByRole("region", { name: "Pendente" });
    fireEvent.click(pendente.querySelector("button")!.parentElement!.querySelector("button")!);
    // O único botão da coluna vazia é o "+ Adicionar um cartão".
    const textarea = await screen.findByPlaceholderText("Nova tarefa em Pendente…");
    fireEvent.change(textarea, { target: { value: "Pedido da Dona Maria" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() =>
      expect(mocks.createTaskCard).toHaveBeenCalledWith({
        title: "Pedido da Dona Maria",
        status: 2,
        labelIds: [],
        memberIds: [],
      }),
    );
  });

  it("a modal mostra a solução registrada, o Finalizar tarefa e a atividade em ordem, com autoria", async () => {
    mocks.useGetTaskCard.mockReturnValue({
      data: { ...detail, solution: "<p>Troquei a <em>lâmina</em> de corte</p>" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    await waitFor(() => expect(screen.getByText("registrada")).toBeTruthy());
    expect(screen.getByText("lâmina").tagName).toBe("EM");
    expect(screen.getByRole("button", { name: /Finalizar tarefa/ })).toBeTruthy();

    const activity = screen.getByRole("region", { name: "Atividade" });
    const items = within(activity).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Ana Souza criou o cartão em Backlog · 30\/09\/2026 às 10:00$/),
      expect.stringMatching(/^Bruno Lima moveu o cartão de Backlog para Fazendo/),
      expect.stringContaining("Liguei para o técnico"),
      expect.stringContaining("Ele vem amanhã"),
    ]);
    expect(within(items[3]).getByText("(editado)")).toBeTruthy();
    // Só o comentário da Ana (a sessão) tem Editar e Excluir.
    expect(within(items[2]).queryByRole("button", { name: "Editar" })).toBeNull();
    expect(within(items[3]).getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(within(items[3]).getByRole("button", { name: "Excluir" })).toBeTruthy();

    // Só comentários esconde o histórico.
    fireEvent.click(within(activity).getByRole("button", { name: "Só comentários" }));
    expect(within(activity).getAllByRole("listitem")).toHaveLength(2);
  });

  it("Finalizar tarefa move para o fim de Finalizado", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    fireEvent.click(await screen.findByRole("button", { name: /Finalizar tarefa/ }));

    await waitFor(() => expect(mocks.moveTaskCard).toHaveBeenCalledWith(7, { status: 5, position: 0 }));
  });

  it("cartão finalizado mostra Finalizada no lugar do botão", async () => {
    mocks.useGetTaskCard.mockReturnValue({
      data: { ...detail, status: "Done" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    await waitFor(() => expect(screen.getByText("Finalizada")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /Finalizar tarefa/ })).toBeNull();
  });

  it("Salvar e finalizar grava a solução e finaliza na mesma chamada", async () => {
    mocks.useGetTaskCard.mockReturnValue({
      data: { ...detail, solution: "<p>Troquei o cabo</p>" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    // O "Editar" da solução é o segundo (o primeiro é o da descrição).
    const editButtons = await screen.findAllByRole("button", { name: "Editar" });
    fireEvent.click(editButtons[1]);
    fireEvent.click(await screen.findByRole("button", { name: /Salvar e finalizar/ }));

    await waitFor(() =>
      expect(mocks.saveTaskCardSolution).toHaveBeenCalledWith(7, {
        solution: "<p>Troquei o cabo</p>",
        finish: true,
      }),
    );
  });

  it("a solução vazia abre o editor com a barra de formatação, sem Salvar e finalizar habilitado", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));

    expect(await screen.findByRole("toolbar", { name: "Formatação do texto" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Solução do cartão" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Salvar e finalizar/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  // Regressões da revisão adversarial de 05/10/2026.

  it("Esc dentro do editor cancela a edição e não fecha a modal", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));
    const textbox = await screen.findByRole("textbox", { name: "Solução do cartão" });

    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatação do texto" })).toBeNull());
    // A modal continua aberta: o título do cartão segue na tela.
    expect(screen.getByLabelText("Título do cartão")).toBeTruthy();
  });

  it("falha ao salvar a solução mantém o editor aberto com o rascunho", async () => {
    mocks.saveTaskCardSolution.mockRejectedValueOnce(new Error("Sem conexão"));
    mocks.useGetTaskCard.mockReturnValue({
      data: { ...detail, solution: "<p>Troquei o cabo</p>" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    const editButtons = await screen.findAllByRole("button", { name: "Editar" });
    fireEvent.click(editButtons[1]);

    fireEvent.click(await screen.findByRole("button", { name: /Salvar e finalizar/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
    expect(screen.getByRole("textbox", { name: "Solução do cartão" }).textContent).toBe("Troquei o cabo");
  });

  it("a caixa de comentário tem altura máxima e rola por dentro", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Escreva um comentário…"));

    const textbox = await screen.findByRole("textbox", { name: "Novo comentário" });
    expect(textbox.style.maxHeight).not.toBe("");
    expect(textbox.style.overflowY).toBe("auto");
  });
});
