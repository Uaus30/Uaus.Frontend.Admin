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
  useSearchTaskCards: vi.fn(),
  createTaskCard: vi.fn(),
  moveTaskCard: vi.fn(),
  saveTaskCardSolution: vi.fn(),
  updateTaskCardComment: vi.fn(),
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
  useSearchTaskCards: mocks.useSearchTaskCards,
  createTaskCard: mocks.createTaskCard,
  moveTaskCard: mocks.moveTaskCard,
  saveTaskCardSolution: mocks.saveTaskCardSolution,
  updateTaskCardComment: mocks.updateTaskCardComment,
  useGetTaskCardActivities: mocks.useGetTaskCardActivities,
  useGetMe: mocks.useGetMe,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { default: TaskBoardPage } = await import("@/pages/task-board");

const ANA = { userId: 3, firstName: "Ana", fullName: "Ana Souza" };
const BRUNO = { userId: 9, firstName: "Bruno", fullName: "Bruno Lima" };

const summary: TaskCardSummaryDto = {
  id: 7,
  number: 7,
  title: "Trocar a impressora do caixa",
  status: "Pending",
  priority: "Urgent",
  hasDescription: true,
  descriptionPreview: "A impressora térmica parou de cortar o cupom.",
  attachmentsCount: 1,
  labels: [{ id: 1, name: "Bug", color: "red", priority: "Urgent", createdAt: "2026-09-30T10:00:00" }],
  assignee: ANA,
  createdAt: "2026-09-30T10:00:00",
  createdBy: "Bruno Lima",
};

/** Do Bruno: some em "minhas", que é como a tela abre. */
const brunos: TaskCardSummaryDto = {
  ...summary,
  id: 8,
  number: 8,
  title: "Pedir orçamento de etiquetas",
  priority: "Low",
  descriptionPreview: undefined,
  attachmentsCount: 0,
  labels: [],
  assignee: BRUNO,
  createdBy: "Bruno Lima",
};

const finished: TaskCardSummaryDto = {
  ...summary,
  id: 6,
  number: 6,
  title: "Cadastrar a compra da Toy Mix",
  status: "Done",
  finishedAt: "2026-10-22T10:00:00",
  finishedBy: "Ana Souza",
  solutionPreview: "Cadastrado com as fotos.",
  labels: [],
};

const detail: TaskCardDto = {
  id: summary.id,
  number: summary.number,
  title: summary.title,
  status: summary.status,
  priority: summary.priority,
  labels: summary.labels,
  assignee: ANA,
  description: "A impressora térmica parou de cortar o cupom.",
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
  createdAt: "2026-09-30T10:00:00",
  createdBy: "Ana",
};

const board: TaskBoardDto = {
  items: [summary, brunos, finished],
  hiddenFinishedCount: 3,
  finishedWindowDays: 30,
};

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
    kind: "AssigneeChanged",
    text: "Ana Souza",
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
 * Smoke de montagem: a página inteira (lista, filtros, modal, nova tarefa)
 * renderiza em jsdom sem erro e a interação básica funciona. Não substitui o
 * smoke no navegador; pega o que o typecheck não pega — import quebrado, hook
 * fora de provider, componente que explode ao montar.
 */
describe("TaskBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetTaskBoard.mockReturnValue({ data: board, isLoading: false, isError: false, error: null });
    mocks.useGetTaskCard.mockReturnValue({ data: detail, isLoading: false, isError: false });
    mocks.useGetTaskLabels.mockReturnValue({ data: summary.labels, isLoading: false });
    mocks.useGetTaskBoardMembers.mockReturnValue({ data: [ANA, BRUNO] });
    mocks.useSearchTaskCards.mockReturnValue({ data: [], isFetching: false });
    mocks.useGetTaskCardActivities.mockReturnValue({ data: activities, isLoading: false, isError: false });
    mocks.useGetMe.mockReturnValue({ data: { id: 3, firstName: "Ana", lastName: "Souza" } });
    mocks.moveTaskCard.mockResolvedValue(null);
    mocks.saveTaskCardSolution.mockResolvedValue(null);
  });

  it("abre nas minhas pendentes: o cartão grande com prioridade, prévia, para quem e o botão de concluir", () => {
    renderPage();

    const tabs = screen.getByRole("tablist", { name: "Situação" });
    expect(
      within(tabs)
        .getByRole("tab", { name: /1\s*Pendentes\s*para você/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(tabs).getByRole("tab", { name: /1\s*Finalizadas/ })).toBeTruthy();

    const cards = screen.getAllByTestId("task-card");
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(within(card).getByText("Trocar a impressora do caixa")).toBeTruthy();
    expect(within(card).getByText("Urgente")).toBeTruthy();
    expect(within(card).getByText("#7")).toBeTruthy();
    expect(within(card).getByText("A impressora térmica parou de cortar o cupom.")).toBeTruthy();
    expect(within(card).getByText("Para você")).toBeTruthy();
    expect(within(card).getByText("· anotada por Bruno")).toBeTruthy();
    expect(within(card).getByText("Bug")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Concluir a tarefa #7" })).toBeTruthy();
    // A do Bruno só aparece em "Todas as pessoas".
    expect(screen.queryByText("Pedir orçamento de etiquetas")).toBeNull();
  });

  it("o botão grande conclui sem abrir a tarefa, e o aviso traz Desfazer", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Concluir a tarefa #7" }));

    await waitFor(() => expect(mocks.moveTaskCard).toHaveBeenCalledWith(7, { status: 5, position: 0 }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Tarefa #7 concluída.", action: expect.anything() }),
      ),
    );
    expect(mocks.useGetTaskCard).not.toHaveBeenCalledWith(7);
  });

  it("a aba Finalizadas mostra quem concluiu, a solução, o Reabrir e o link das antigas", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("tab", { name: /Finalizadas/ }));

    const card = screen.getByTestId("task-card");
    expect(within(card).getByText("Cadastrar a compra da Toy Mix")).toBeTruthy();
    expect(within(card).getByText("Finalizada")).toBeTruthy();
    expect(within(card).getByText(/, por Ana$/)).toBeTruthy();
    expect(within(card).getByText("Cadastrado com as fotos.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver as 3 mais antigas" })).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "Reabrir a tarefa #6" }));
    await waitFor(() => expect(mocks.moveTaskCard).toHaveBeenCalledWith(6, { status: 2, position: 0 }));
  });

  it("Nova tarefa nasce para quem está logado e Normal; trocar o responsável e a prioridade vai junto", async () => {
    mocks.createTaskCard.mockResolvedValue({ ...detail, id: 20, number: 20, assignee: BRUNO });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Nova tarefa/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nova tarefa" });
    expect(within(dialog).getByRole("radio", { name: /Ana/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(dialog).getByRole("radio", { name: "Normal" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.change(within(dialog).getByLabelText("O que precisa ser feito?"), {
      target: { value: "Pedido da Dona Maria" },
    });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Bruno/ }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "Alta" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Salvar tarefa/ }));

    await waitFor(() =>
      expect(mocks.createTaskCard).toHaveBeenCalledWith({
        title: "Pedido da Dona Maria",
        description: null,
        priority: 3,
        assigneeId: 9,
        labelIds: [],
      }),
    );
  });

  it("Nova tarefa sem título não grava e diz o que falta", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Nova tarefa/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nova tarefa" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Salvar tarefa/ }));

    expect(await within(dialog).findByText("Escreva o que precisa ser feito.")).toBeTruthy();
    expect(mocks.createTaskCard).not.toHaveBeenCalled();
  });

  it("clicar no cartão abre a modal com descrição, responsável, prioridade e anexo", async () => {
    renderPage();

    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    await waitFor(() => expect(screen.getByLabelText("Título da tarefa")).toBeTruthy());
    expect((screen.getByLabelText("Título da tarefa") as HTMLInputElement).value).toBe(
      "Trocar a impressora do caixa",
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("A impressora térmica parou de cortar o cupom.")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Responsável: Ana Souza" })).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: "Urgente" }).getAttribute("aria-checked")).toBe("true");
    expect(within(dialog).getByText("foto.jpg")).toBeTruthy();
    expect(mocks.useGetTaskCard).toHaveBeenLastCalledWith(7);
  });

  it("a modal mostra a solução registrada, o Concluir tarefa e a atividade em ordem, com autoria", async () => {
    mocks.useGetTaskCard.mockReturnValue({
      data: { ...detail, solution: "<p>Troquei a <em>lâmina</em> de corte</p>" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    await waitFor(() => expect(screen.getByText("registrada")).toBeTruthy());
    expect(screen.getByText("lâmina").tagName).toBe("EM");
    expect(screen.getByRole("button", { name: /Concluir tarefa/ })).toBeTruthy();

    const activity = screen.getByRole("region", { name: "Atividade" });
    const items = within(activity).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Ana Souza criou a tarefa em Backlog · 30\/09\/2026 às 10:00$/),
      expect.stringMatching(/^Bruno Lima passou a tarefa para “Ana Souza”/),
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

  it("Concluir tarefa, no topo da modal, conclui e fecha", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    fireEvent.click(await screen.findByRole("button", { name: /Concluir tarefa/ }));

    await waitFor(() => expect(mocks.moveTaskCard).toHaveBeenCalledWith(7, { status: 5, position: 0 }));
    await waitFor(() => expect(screen.queryByLabelText("Título da tarefa")).toBeNull());
  });

  // Achado da revisão de 23/10/2026: concluir fecha a modal, e o rascunho ia junto.
  it("Concluir tarefa com uma edição aberta não fecha nem conclui: o rascunho fica", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));
    await screen.findByRole("textbox", { name: "Solução da tarefa" });

    fireEvent.click(screen.getByRole("button", { name: /Concluir tarefa/ }));

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Salve ou cancele a edição antes de concluir." }),
    );
    expect(mocks.moveTaskCard).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Solução da tarefa" })).toBeTruthy();
  });

  it("tarefa finalizada mostra Finalizada e Reabrir no lugar do botão", async () => {
    mocks.useGetTaskCard.mockReturnValue({
      data: { ...detail, status: "Done" },
      isLoading: false,
      isError: false,
    });
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Finalizada")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: /Concluir tarefa/ })).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: /Reabrir/ }));
    await waitFor(() => expect(mocks.moveTaskCard).toHaveBeenCalledWith(7, { status: 2, position: 0 }));
  });

  it("Salvar e concluir grava a solução e conclui na mesma chamada", async () => {
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
    fireEvent.click(await screen.findByRole("button", { name: /Salvar e concluir/ }));

    await waitFor(() =>
      expect(mocks.saveTaskCardSolution).toHaveBeenCalledWith(7, {
        solution: "<p>Troquei o cabo</p>",
        finish: true,
      }),
    );
  });

  it("a solução vazia abre o editor com a barra de formatação, sem Salvar e concluir habilitado", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));

    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));

    expect(await screen.findByRole("toolbar", { name: "Formatação do texto" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Solução da tarefa" })).toBeTruthy();
    expect((screen.getByRole("button", { name: /Salvar e concluir/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  // Regressões da revisão adversarial de 05/10/2026.

  it("Esc dentro do editor cancela a edição e não fecha a modal", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));
    const textbox = await screen.findByRole("textbox", { name: "Solução da tarefa" });

    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatação do texto" })).toBeNull());
    // A modal continua aberta: o título da tarefa segue na tela.
    expect(screen.getByLabelText("Título da tarefa")).toBeTruthy();
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

    fireEvent.click(await screen.findByRole("button", { name: /Salvar e concluir/ }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
    expect(screen.getByRole("textbox", { name: "Solução da tarefa" }).textContent).toBe("Troquei o cabo");
  });

  it("a caixa de comentário tem altura máxima e rola por dentro", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Escreva um comentário…"));

    const textbox = await screen.findByRole("textbox", { name: "Novo comentário" });
    expect(textbox.style.maxHeight).not.toBe("");
    expect(textbox.style.overflowY).toBe("auto");
  });

  // Ajustes pedidos pelo dono depois da entrega (05/10/2026).

  it("Esc com o foco num botão da edição cancela a edição e não fecha a modal", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));
    const cancel = await screen.findByRole("button", { name: "Cancelar" });

    fireEvent.keyDown(cancel, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatação do texto" })).toBeNull());
    expect(screen.getByLabelText("Título da tarefa")).toBeTruthy();
  });

  it("com uma edição aberta, Esc fora dela não fecha a modal (o rascunho não vai junto)", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Escreva um comentário…"));
    await screen.findByRole("textbox", { name: "Novo comentário" });

    fireEvent.keyDown(screen.getByLabelText("Título da tarefa"), { key: "Escape" });

    expect(screen.getByLabelText("Título da tarefa")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Novo comentário" })).toBeTruthy();
  });

  it("salvar o comentário sem mudar nada não chama o servidor (não vira editado)", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    const activity = await screen.findByRole("region", { name: "Atividade" });
    const mine = within(activity).getAllByRole("listitem")[3];

    fireEvent.click(within(mine).getByRole("button", { name: "Editar" }));
    fireEvent.click(await within(mine).findByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(within(mine).queryByRole("textbox")).toBeNull());
    expect(mocks.updateTaskCardComment).not.toHaveBeenCalled();
  });

  it("Esc para fechar a paleta de cor não cancela a edição (o rascunho fica)", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Trocar a impressora do caixa"));
    fireEvent.click(await screen.findByText("Registrar como a demanda foi resolvida…"));
    const textbox = await screen.findByRole("textbox", { name: "Solução da tarefa" });

    fireEvent.click(screen.getByRole("button", { name: "Cor do texto" }));
    await screen.findByRole("button", { name: "Vermelho" });
    // A paleta não tira o foco do editor: o Esc nasce no texto.
    fireEvent.keyDown(textbox, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("button", { name: "Vermelho" })).toBeNull());
    expect(screen.getByRole("toolbar", { name: "Formatação do texto" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Solução da tarefa" })).toBeTruthy();

    // Com a paleta fechada, o próximo Esc é da edição: cancela, e a modal fica.
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Solução da tarefa" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Formatação do texto" })).toBeNull());
    expect(screen.getByLabelText("Título da tarefa")).toBeTruthy();
  });
});
