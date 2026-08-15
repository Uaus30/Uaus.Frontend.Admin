import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetFixedCosts: vi.fn(),
  createFixedCost: vi.fn(),
  updateFixedCost: vi.fn(),
  deleteFixedCost: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetFixedCosts: mocks.useGetFixedCosts,
  createFixedCost: mocks.createFixedCost,
  updateFixedCost: mocks.updateFixedCost,
  deleteFixedCost: mocks.deleteFixedCost,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const {
  useFixedCosts,
  currentMonthKey,
  formatMonth,
  isFixedCostActive,
  monthKeyToPayloadDate,
} = await import("../useFixedCosts");

/** Evento de submit mínimo — o hook só chama `preventDefault`. */
const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

/** DTO de exemplo, no formato devolvido pela API. */
const rentCost = {
  id: 7,
  createdAt: "2026-01-05T10:00:00",
  updatedAt: null,
  name: "Aluguel",
  monthlyAmount: 3500,
  startsOn: "2026-01-01T00:00:00",
  endsOn: null,
  notes: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFixedCosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetFixedCosts.mockReturnValue({
      data: { data: [rentCost], page: 1, limit: 10, total: 1, totalPages: 1 },
      isLoading: false,
    });
    mocks.createFixedCost.mockResolvedValue(1);
    mocks.updateFixedCost.mockResolvedValue(rentCost);
    mocks.deleteFixedCost.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("deve inicializar com os estados padrão", () => {
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.searchInput).toBe("");
    expect(result.current.modalOpen).toBe(false);
    expect(result.current.editingId).toBeNull();
    expect(result.current.fixedCosts).toEqual([rentCost]);
  });

  it("deve aplicar a busca com debounce de 300ms e voltar para a página 1", () => {
    vi.useFakeTimers();
    // Cinco páginas no servidor — a página 3 existe e não sofre o recuo
    // automático para a última página disponível.
    mocks.useGetFixedCosts.mockReturnValue({
      data: { data: [rentCost], page: 1, limit: 10, total: 42, totalPages: 5 },
      isLoading: false,
    });
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    act(() => result.current.setSearchInput("alu"));

    // Antes dos 300ms o filtro digitado ainda não foi aplicado.
    act(() => vi.advanceTimersByTime(299));
    let lastParams = mocks.useGetFixedCosts.mock.calls.at(-1)?.[0];
    expect(lastParams.search).toBeUndefined();
    expect(lastParams.page).toBe(3);

    act(() => vi.advanceTimersByTime(1));
    lastParams = mocks.useGetFixedCosts.mock.calls.at(-1)?.[0];
    expect(lastParams.search).toBe("alu");
    expect(lastParams.page).toBe(1);
  });

  it("deve recuar para a última página quando a página atual deixa de existir", async () => {
    // Duas páginas no servidor (12 itens): a página 3 não existe — é o cenário
    // de excluir o último item da última página e ficar preso numa tela vazia.
    mocks.useGetFixedCosts.mockReturnValue({
      data: { data: [rentCost], page: 2, limit: 10, total: 12, totalPages: 2 },
      isLoading: false,
    });

    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));

    await waitFor(() => expect(result.current.page).toBe(2));
  });

  it("deve abrir a modal de edição com o formulário preenchido a partir do DTO", () => {
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenEdit(rentCost));

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.editingId).toBe(7);
    expect(result.current.form).toEqual({
      name: "Aluguel",
      monthlyAmount: "3500",
      startsOn: "2026-01",
      endsOn: "",
      notes: "",
    });
  });

  it("não deve salvar com campos obrigatórios vazios ou valor mensal inválido", async () => {
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenCreate());
    act(() => result.current.setForm({ ...result.current.form, name: "Aluguel", monthlyAmount: "0" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.createFixedCost).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Preencha os campos obrigatórios", variant: "destructive" }),
    );
  });

  it("deve recusar vigência final anterior ao início", async () => {
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenCreate());
    act(() =>
      result.current.setForm({
        name: "Aluguel",
        monthlyAmount: "3500",
        startsOn: "2026-06",
        endsOn: "2026-01",
        notes: "",
      }),
    );
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.createFixedCost).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Vigência inválida", variant: "destructive" }),
    );
  });

  it("deve cadastrar enviando as competências como dia 1 e fechar a modal", async () => {
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenCreate());
    act(() =>
      result.current.setForm({
        name: "  Contador  ",
        monthlyAmount: "980.50",
        startsOn: "2026-02",
        endsOn: "",
        notes: " ",
      }),
    );
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.createFixedCost).toHaveBeenCalledWith({
        name: "Contador",
        monthlyAmount: 980.5,
        startsOn: "2026-02-01",
        endsOn: null,
        notes: null,
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Custo fixo cadastrado." }),
      ),
    );
    expect(result.current.modalOpen).toBe(false);
  });

  it("deve atualizar o custo em modo de edição", async () => {
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenEdit(rentCost));
    act(() =>
      result.current.setForm({
        name: "Aluguel",
        monthlyAmount: "3800",
        startsOn: "2026-01",
        endsOn: "2026-12",
        notes: "Reajuste anual",
      }),
    );
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.updateFixedCost).toHaveBeenCalledWith(7, {
        name: "Aluguel",
        monthlyAmount: 3800,
        startsOn: "2026-01-01",
        endsOn: "2026-12-01",
        notes: "Reajuste anual",
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Custo fixo atualizado." }),
      ),
    );
  });

  it("deve mostrar a mensagem do backend quando a gravação falha e manter a modal aberta", async () => {
    mocks.createFixedCost.mockRejectedValue(
      Object.assign(new Error("O valor mensal deve ser maior que zero!"), {
        status: 400,
        payload: { message: "O valor mensal deve ser maior que zero!" },
      }),
    );

    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    act(() => result.current.handleOpenCreate());
    act(() =>
      result.current.setForm({
        name: "Energia",
        monthlyAmount: "450",
        startsOn: "2026-03",
        endsOn: "",
        notes: "",
      }),
    );
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao salvar o custo fixo",
          description: "O valor mensal deve ser maior que zero!",
          variant: "destructive",
        }),
      ),
    );
    expect(result.current.modalOpen).toBe(true);
  });

  it("deve encerrar o custo na competência atual após confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.handleEndFixedCost(rentCost);
    });

    await waitFor(() =>
      expect(mocks.updateFixedCost).toHaveBeenCalledWith(7, {
        name: "Aluguel",
        monthlyAmount: 3500,
        startsOn: "2026-01-01",
        endsOn: monthKeyToPayloadDate(currentMonthKey()),
        notes: null,
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Custo fixo encerrado." }),
      ),
    );
  });

  it("não deve excluir quando a confirmação é negada", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.handleDelete(rentCost);
    });

    expect(mocks.deleteFixedCost).not.toHaveBeenCalled();
  });

  it("deve excluir após confirmação e avisar o usuário", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result } = renderHook(() => useFixedCosts(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.handleDelete(rentCost);
    });

    await waitFor(() => expect(mocks.deleteFixedCost).toHaveBeenCalledWith(7));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Custo fixo excluído." }),
      ),
    );
  });
});

describe("helpers de competência", () => {
  it("deve formatar a competência em PT-BR", () => {
    expect(formatMonth("2026-01-01T00:00:00")).toBe("jan/2026");
    expect(formatMonth("2026-08")).toBe("ago/2026");
    expect(formatMonth("2025-12-01")).toBe("dez/2025");
  });

  it("deve considerar vigente o custo sem fim ou com fim no mês atual ou futuro", () => {
    expect(isFixedCostActive({ ...rentCost, endsOn: null })).toBe(true);
    expect(isFixedCostActive({ ...rentCost, endsOn: `${currentMonthKey()}-01T00:00:00` })).toBe(true);
    expect(isFixedCostActive({ ...rentCost, endsOn: "2020-01-01T00:00:00" })).toBe(false);
  });
});
