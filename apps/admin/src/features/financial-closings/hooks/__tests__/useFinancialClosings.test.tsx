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

const { useFinancialClosings, previousMonthRange } = await import("../useFinancialClosings");

/** Prévia com o formato devolvido pelo servidor. */
const previewFixture = {
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
  shares: [{ partnerId: 1, partnerName: "Sócio A", percentage: 100, amount: 4800 }],
  fixedCosts: { total: 4200, items: [] },
  warnings: [],
};

/** Fechamento confirmado, usado no fluxo de exclusão. */
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

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.newClosingOpen).toBe(false);
    expect(result.current.step).toBe("periodo");
    expect(result.current.preview).toBeNull();
    expect(result.current.detailsId).toBeNull();
    expect(result.current.closings).toEqual([closingFixture]);
  });

  it("deve voltar para a primeira página ao aplicar o filtro de período", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    act(() => result.current.handleFilterRangeChange("2026-01-01", "2026-12-31"));

    expect(result.current.page).toBe(1);
    expect(result.current.filterStartDate).toBe("2026-01-01");
    expect(result.current.filterEndDate).toBe("2026-12-31");
  });

  it("deve montar o mês-calendário cheio anterior no atalho", () => {
    // 15/08/2026 → julho cheio; 10/01/2026 → dezembro do ano anterior.
    expect(previousMonthRange(new Date(2026, 7, 15))).toEqual({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
    expect(previousMonthRange(new Date(2026, 0, 10))).toEqual({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
    });
  });

  it("deve preencher o período com o mês anterior ao usar o atalho", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.applyPreviousMonth());

    const expected = previousMonthRange();
    expect(result.current.periodStart).toBe(expected.periodStart);
    expect(result.current.periodEnd).toBe(expected.periodEnd);
  });

  it("não deve calcular a prévia sem o período completo", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    expect(mocks.previewFinancialClosing).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Informe o período", variant: "destructive" }),
    );
  });

  it("deve calcular a prévia e avançar para o passo de confirmação", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-01", "2026-07-31"));
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    await waitFor(() => expect(result.current.step).toBe("previa"));
    expect(mocks.previewFinancialClosing).toHaveBeenCalledWith({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    });
    expect(result.current.preview).toEqual(previewFixture);
  });

  it("deve mostrar a mensagem do backend quando a prévia falha", async () => {
    mocks.previewFinancialClosing.mockRejectedValue(new Error("Período inicial deve ser anterior ao final!"));

    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-31", "2026-07-01"));
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
    expect(result.current.step).toBe("periodo");
  });

  it("deve confirmar o fechamento, avisar e fechar o diálogo", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-01", "2026-07-31"));
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
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        notes: null,
      }),
    );
    await waitFor(() => expect(result.current.newClosingOpen).toBe(false));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Fechamento confirmado" }));
  });

  it("deve enviar as observações sem espaços das pontas", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-01", "2026-07-31"));
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));
    act(() => result.current.setNotes("  Fechamento de julho  "));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    await waitFor(() =>
      expect(mocks.createFinancialClosing).toHaveBeenCalledWith({
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        notes: "Fechamento de julho",
      }),
    );
  });

  it("deve confirmar com o período congelado da prévia, mesmo que o estado mude depois", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    // Prévia calculada com o período A...
    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-01", "2026-07-31"));
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));

    // ...o estado muda para o período B antes da confirmação...
    act(() => result.current.handlePeriodChange("2026-08-01", "2026-08-31"));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    // ...e a confirmação envia o período A — o mesmo da prévia exibida.
    await waitFor(() =>
      expect(mocks.createFinancialClosing).toHaveBeenCalledWith({
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        notes: null,
      }),
    );
  });

  it("deve bloquear a confirmação sem prévia congelada (e ao voltar ao passo do período)", async () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    // Sem prévia calculada, confirmar é um no-op.
    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-01", "2026-07-31"));
    await act(async () => {
      result.current.handleConfirmClosing();
    });
    expect(mocks.createFinancialClosing).not.toHaveBeenCalled();

    // Voltar ao passo do período descarta a prévia congelada...
    await act(async () => {
      result.current.handleCalculatePreview();
    });
    await waitFor(() => expect(result.current.step).toBe("previa"));
    act(() => result.current.backToPeriod());

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

    act(() => result.current.openNewClosing());
    act(() => result.current.handlePeriodChange("2026-07-01", "2026-07-31"));
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
