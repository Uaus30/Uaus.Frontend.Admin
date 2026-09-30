import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@workspace/ui";
import type { TaskBoardDto, TaskCardDto, TaskCardSummaryDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetTaskBoard: vi.fn(),
  useGetTaskCard: vi.fn(),
  useGetTaskLabels: vi.fn(),
  useGetTaskBoardMembers: vi.fn(),
  useGetArchivedTaskCards: vi.fn(),
  useSearchTaskCards: vi.fn(),
  createTaskCard: vi.fn(),
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
});
