import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetFinancialClosings: vi.fn(),
  useGetFinancialClosingById: vi.fn(),
  previewFinancialClosing: vi.fn(),
  createFinancialClosing: vi.fn(),
  deleteFinancialClosing: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado — as chaves de cache vêm do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetFinancialClosings: mocks.useGetFinancialClosings,
  useGetFinancialClosingById: mocks.useGetFinancialClosingById,
  previewFinancialClosing: mocks.previewFinancialClosing,
  createFinancialClosing: mocks.createFinancialClosing,
  deleteFinancialClosing: mocks.deleteFinancialClosing,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useFinancialClosings } = await import("../useFinancialClosings");
const { lastEndedMonth } = await import("../../month-selection");

/** Prévia com o formato devolvido pelo servidor. */
const previewFixture = {
  periodStart: "2026-08-01T00:00:00",
  periodEnd: "2026-08-31T00:00:00",
  revenue: 30000,
  discounts: 500,
  cogsCost: 20500,
  grossProfit: 9000,
  purchasesTotal: 18000,
  writeOffLossesTotal: 300,
  fixedCostsTotal: 4200,
  netProfit: 4800,
  salesCount: 412,
  shares: [{ partnerId: 1, partnerName: "Sócio A", percentage: 100, amount: 4800 }],
  fixedCosts: { total: 4200, items: [] },
  warnings: [],
};

/**
 * Fechamento confirmado (julho/2026), usado no fluxo de exclusão — e também
 * como o fechamento existente que trava julho no select de mês, porque o mock
 * devolve a mesma lista para a listagem e para a consulta dos meses fechados.
 */
const closingFixture = {
  id: 5,
  createdAt: "2026-08-01T09:00:00",
  periodStart: "2026-07-01T00:00:00",
  periodEnd: "2026-07-31T00:00:00",
  revenue: 30000,
  discounts: 500,
  cogsCost: 20500,
  grossProfit: 9000,
  purchasesTotal: 18000,
  writeOffLossesTotal: 300,
  fixedCostsTotal: 4200,
  netProfit: 4800,
  salesCount: 412,
  notes: null,
  closedByUserId: 1,
  closedByUserName: "Wagner",
  shares: [{ partnerId: 1, partnerName: "Sócio A", percentage: 100, amount: 4800 }],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFinancialClosings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetFinancialClosings.mockReturnValue({
      data: { data: [closingFixture], page: 1, limit: 10, total: 1, totalPages: 1 },
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useGetFinancialClosingById.mockReturnValue({ data: undefined, isLoading: false });
    mocks.previewFinancialClosing.mockResolvedValue(previewFixture);
    mocks.createFinancialClosing.mockResolvedValue(7);
    mocks.deleteFinancialClosing.mockResolvedValue(undefined);
  });

  /** Abre o diálogo e escolhe agosto/2026 — mês livre no fixture. */
  function selectAugust2026(result: { current: ReturnType<typeof useFinancialClosings> }) {
    act(() => result.current.openNewClosing());
    act(() => result.current.handleYearChange(2026));
    act(() => result.current.handleMonthChange(8));
  }

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.newClosingOpen).toBe(false);
    expect(result.current.step).toBe("competencia");
    expect(result.current.month).toBeNull();
    expect(result.current.year).toBe(new Date().getFullYear());
    expect(result.current.preview).toBeNull();
    expect(result.current.detailsId).toBeNull();
    expect(result.current.closings).toEqual([closingFixture]);
  });

  it("deve listar sem filtro de data — a tela não filtra mais por período", () => {
    renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    // A listagem manda só paginação; a consulta com datas é a dos meses
    // fechados, e ela só roda com o diálogo aberto.
    expect(mocks.useGetFinancialClosings).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(mocks.useGetFinancialClosings).toHaveBeenCalledWith(expect.anything(), {
      query: { enabled: false },
    });
  });

  it("deve travar os meses que já têm fechamento", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.handleYearChange(2026));

    // O fixture fecha julho/2026: só ele fica indisponível por já estar fechado.
    expect(result.current.monthOptions[6]).toMatchObject({
      month: 7,
      availability: "fechado",
      disabled: true,
    });
    expect(result.current.monthOptions.filter((option) => option.availability === "fechado")).toHaveLength(1);
  });

  it("deve limpar o mês ao trocar de ano — a disponibilidade é outra", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    selectAugust2026(result);
    act(() => result.current.handleYearChange(2025));

    expect(result.current.year).toBe(2025);
    expect(result.current.month).toBeNull();
  });

  it("deve selecionar o último mês encerrado no atalho", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.applyLastMonth());

    expect({ year: result.current.year, month: result.current.month }).toEqual(lastEndedMonth());
  });

  it("não deve calcular a prévia sem competência escolhida", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    expect(mocks.previewFinancialClosing).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Escolha a competência", variant: "destructive" }),
    );
  });

  it("não deve calcular a prévia de um mês já fechado", async () => {
    // O select trava o mês fechado, mas o atalho "Último mês" não passa por ele.
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.handleYearChange(2026));
    act(() => result.current.handleMonthChange(7));
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    expect(mocks.previewFinancialClosing).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mês já fechado", variant: "destructive" }),
    );
  });

  it("deve calcular a prévia do mês-calendário cheio e avançar para a confirmação", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    selectAugust2026(result);
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    await waitFor(() => expect(result.current.step).toBe("previa"));
    expect(mocks.previewFinancialClosing).toHaveBeenCalledWith({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });
    expect(result.current.preview).toEqual(previewFixture);
  });

  it("deve mostrar a mensagem do backend quando a prévia falha", async () => {
    mocks.previewFinancialClosing.mockRejectedValue(new Error("Período inicial deve ser anterior ao final!"));

    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    selectAugust2026(result);
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao calcular a prévia",
          description: "Período inicial deve ser anterior ao final!",
          variant: "destructive",
        }),
      ),
    );
    expect(result.current.step).toBe("competencia");
  });

  it("deve confirmar o fechamento, avisar e fechar o diálogo", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    selectAugust2026(result);
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    // Sem observações digitadas, o payload vai com notes null.
    await waitFor(() =>
      expect(mocks.createFinancialClosing).toHaveBeenCalledWith({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        notes: null,
      }),
    );
    await waitFor(() => expect(result.current.newClosingOpen).toBe(false));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Fechamento confirmado" }));
  });

  it("deve enviar as observações sem espaços das pontas", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    selectAugust2026(result);
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));
    act(() => result.current.setNotes("  Fechamento de agosto  "));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    await waitFor(() =>
      expect(mocks.createFinancialClosing).toHaveBeenCalledWith({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        notes: "Fechamento de agosto",
      }),
    );
  });

  it("deve confirmar com o período congelado da prévia, mesmo que a competência mude depois", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    // Prévia calculada com agosto...
    selectAugust2026(result);
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));

    // ...a competência muda para setembro antes da confirmação...
    act(() => result.current.handleMonthChange(9));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    // ...e a confirmação envia agosto — o mesmo período da prévia exibida.
    await waitFor(() =>
      expect(mocks.createFinancialClosing).toHaveBeenCalledWith({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        notes: null,
      }),
    );
  });

  it("deve bloquear a confirmação sem prévia congelada (e ao voltar ao passo da competência)", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    // Sem prévia calculada, confirmar é um no-op.
    selectAugust2026(result);
    await act(async () => {
      result.current.handleConfirmClosing();
    });
    expect(mocks.createFinancialClosing).not.toHaveBeenCalled();

    // Voltar ao passo da competência descarta a prévia congelada...
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));
    act(() => result.current.backToCompetence());

    expect(result.current.preview).toBeNull();

    // ...e a confirmação volta a ficar bloqueada até recalcular.
    await act(async () => {
      result.current.handleConfirmClosing();
    });
    expect(mocks.createFinancialClosing).not.toHaveBeenCalled();
  });

  it("deve manter o diálogo aberto e mostrar o erro quando a confirmação falha", async () => {
    // A sobreposição de período chega como mensagem do backend.
    mocks.createFinancialClosing.mockRejectedValue(
      new Error("Já existe um fechamento que sobrepõe este período!"),
    );

    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    selectAugust2026(result);
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao confirmar o fechamento",
          description: "Já existe um fechamento que sobrepõe este período!",
          variant: "destructive",
        }),
      ),
    );
    expect(result.current.newClosingOpen).toBe(true);
  });

  it("deve excluir o fechamento e fechar o diálogo de detalhe", async () => {
    // O aviso saiu do hook: quem pergunta é o `ConfirmDialog` do diálogo de
    // detalhe, coberto em `packages/ui`. Aqui fica o efeito da exclusão.
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openDetails(5));
    await act(async () => {
      await result.current.handleDeleteClosing(closingFixture as never);
    });

    await waitFor(() => expect(mocks.deleteFinancialClosing).toHaveBeenCalledWith(5));
    await waitFor(() => expect(result.current.detailsId).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Fechamento excluído" }));
  });

  it("deve propagar a falha da exclusão para quem confirmou", async () => {
    // A rejeição é o que mantém o `ConfirmDialog` aberto: engolindo o erro, ele
    // fecharia como se o documento tivesse saído, com o toast de falha atrás.
    mocks.deleteFinancialClosing.mockRejectedValueOnce(new Error("500"));

    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.handleDeleteClosing(closingFixture as never);
      }),
    ).rejects.toThrow();
  });
});
