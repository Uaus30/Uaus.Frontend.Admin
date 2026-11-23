import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGetCapitalContributionsQueryKey,
  getGetFinancialClosingsQueryKey,
  getGetPurchaseBudgetQueryKey,
  type FinancialClosingNextDto,
  type PreviewFinancialClosingPayload,
} from "@workspace/api-client-react";
import { closingFixture, previewFixture } from "../../__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  useGetFinancialClosings: vi.fn(),
  useGetFinancialClosingNext: vi.fn(),
  previewFinancialClosing: vi.fn(),
  createFinancialClosing: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado — as chaves de cache vêm do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetFinancialClosings: mocks.useGetFinancialClosings,
  useGetFinancialClosingNext: mocks.useGetFinancialClosingNext,
  previewFinancialClosing: mocks.previewFinancialClosing,
  createFinancialClosing: mocks.createFinancialClosing,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useNewClosing } = await import("../useNewClosing");

type Hook = { current: ReturnType<typeof useNewClosing> };

const freezer = { description: "Conserto do freezer", amount: 300 };

/** Outubro aguarda fechamento; setembro (o último) deixou R$ 1.000. */
const nextOctober: FinancialClosingNextDto = {
  month: "2026-10",
  periodStart: "2026-10-01T00:00:00",
  periodEnd: "2026-10-31T00:00:00",
  isImplantation: false,
  previousClosingBalance: 1000,
};

/**
 * O servidor da prévia: ecoa gastos e retiradas e refaz o caixa. Na implantação
 * o saldo inicial é o enviado (ou nenhum); fora dela, o do fechamento anterior.
 */
function fakePreview(implantation: boolean) {
  return async (input: PreviewFinancialClosingPayload) => {
    const variableCosts = input.variableCosts ?? [];
    const variableCostsTotal = variableCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const withdrawalsTotal = input.withdrawals.reduce((sum, item) => sum + item.amount, 0);
    const openingBalance = implantation ? (input.openingBalance ?? undefined) : 1000;
    const monthCash = 3727 - variableCostsTotal;
    return {
      ...previewFixture,
      isImplantation: implantation,
      variableCosts,
      variableCostsTotal,
      netProfit: previewFixture.netProfit - variableCostsTotal,
      monthCash,
      withdrawalsTotal,
      openingBalance,
      calculatedBalance: openingBalance == null ? undefined : openingBalance + monthCash - withdrawalsTotal,
      shares: previewFixture.shares.map((share) => ({
        ...share,
        withdrawnAmount: input.withdrawals.find((item) => item.partnerId === share.partnerId)?.amount ?? 0,
      })),
    };
  };
}

function createWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/** Abre o diálogo e calcula a prévia do mês sugerido (outubro). */
async function previewSuggested(result: Hook) {
  act(() => result.current.openNewClosing());
  expect(result.current.competence.month).toBe(10);
  await act(async () => {
    result.current.handleCalculatePreview();
  });
  await waitFor(() => expect(result.current.step).toBe("resultado"));
}

describe("useNewClosing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 23, 10, 0));
    mocks.useGetFinancialClosings.mockReturnValue({
      data: { data: [closingFixture], page: 1, limit: 200, total: 1, totalPages: 1 },
      isLoading: false,
    });
    mocks.useGetFinancialClosingNext.mockReturnValue({ data: nextOctober, isLoading: false, isError: false });
    mocks.previewFinancialClosing.mockImplementation(fakePreview(false));
    mocks.createFinancialClosing.mockResolvedValue(9);
  });

  afterEach(() => vi.useRealTimers());

  it("sugere o mês que aguarda fechamento e trava os outros, cada um com o motivo", () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    const { competence } = result.current;

    expect({ year: competence.year, month: competence.month }).toEqual({ year: 2026, month: 10 });
    expect(competence.monthOptions[9]).toMatchObject({ availability: "disponivel", disabled: false });
    expect(competence.monthOptions[8]).toMatchObject({ availability: "fechado", disabled: true });
    expect(competence.monthOptions[10]).toMatchObject({
      availability: "aguardando",
      disabled: true,
      statusLabel: "Aguardando outubro",
    });
    expect(competence.monthOptions[7]).toMatchObject({ availability: "anterior", disabled: true });
    expect(competence.monthOptions[11]).toMatchObject({ availability: "nao-iniciado" });
  });

  it("não calcula a prévia de um mês travado pela corrente de saldos", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());
    act(() => result.current.competence.handleMonthChange(11));
    await act(async () => {
      result.current.handleCalculatePreview();
    });

    expect(mocks.previewFinancialClosing).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mês indisponível", variant: "destructive" }),
    );
  });

  it("calcula a prévia do mês cheio, sem retiradas ainda, e vai para o resultado", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);

    expect(mocks.previewFinancialClosing).toHaveBeenCalledWith({
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      variableCosts: [],
      withdrawals: [],
    });
    // Uma linha de retirada por sócio do rateio, em branco.
    expect(result.current.withdrawalDrafts).toEqual({ 1: "", 2: "" });
  });

  it("recalcula no servidor ao lançar um custo variável, com o mesmo período", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    await act(async () => {
      result.current.handleAddVariableCost(freezer);
    });

    await waitFor(() => expect(result.current.preview?.variableCosts).toEqual([freezer]));
    expect(mocks.previewFinancialClosing).toHaveBeenLastCalledWith(
      expect.objectContaining({ periodStart: "2026-10-01", variableCosts: [freezer] }),
    );
    expect(result.current.preview?.netProfit).toBe(previewFixture.netProfit - 300);
  });

  it("a retirada digitada vai à conta ao sair do campo; confirmar antes disso só recalcula", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    act(() => result.current.goToBalance());
    act(() => result.current.setWithdrawal(1, "2000"));

    expect(result.current.inputsDirty).toBe(true);
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      result.current.handleConfirmClosing();
    });

    expect(mocks.createFinancialClosing).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.inputsDirty).toBe(false));
    expect(mocks.previewFinancialClosing).toHaveBeenLastCalledWith(
      expect.objectContaining({
        withdrawals: [
          { partnerId: 1, amount: 2000 },
          { partnerId: 2, amount: 0 },
        ],
      }),
    );
    // 1.000 de saldo inicial + 3.727 de caixa − 2.000 de retirada.
    expect(result.current.closingBalanceText).toBe("2727");
  });

  it("retirada negativa não vai à conta e trava a confirmação", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    act(() => result.current.goToBalance());
    act(() => result.current.setWithdrawal(2, "-5"));
    act(() => result.current.commitBalanceInputs());

    expect(result.current.inputsInvalid).toBe(true);
    expect(result.current.canConfirm).toBe(false);
    expect(mocks.previewFinancialClosing).toHaveBeenCalledTimes(1);
  });

  it("o saldo confirmado nasce com o calculado; a diferença acima de R$ 1,00 exige observação", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    act(() => result.current.goToBalance());
    expect(result.current.closingBalanceText).toBe("4727");
    expect(result.current.canConfirm).toBe(true);

    act(() => result.current.setClosingBalance("4700"));
    expect(result.current.balance).toMatchObject({ difference: -27, notesRequired: true });
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      result.current.handleConfirmClosing();
    });
    expect(mocks.createFinancialClosing).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Confira o saldo" }));

    act(() => result.current.setBalanceNotes("  Taxa da maquininha "));
    expect(result.current.canConfirm).toBe(true);
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    await waitFor(() =>
      expect(mocks.createFinancialClosing).toHaveBeenCalledWith({
        periodStart: "2026-10-01",
        periodEnd: "2026-10-31",
        variableCosts: [],
        withdrawals: [
          { partnerId: 1, amount: 0 },
          { partnerId: 2, amount: 0 },
        ],
        closingBalance: 4700,
        balanceNotes: "Taxa da maquininha",
        notes: null,
      }),
    );
  });

  it("diferença de até R$ 1,00 não pede observação", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    act(() => result.current.goToBalance());
    act(() => result.current.setClosingBalance("4726.00"));

    expect(result.current.balance).toMatchObject({ difference: -1, notesRequired: false, problem: null });
    expect(result.current.canConfirm).toBe(true);
  });

  it("implantação: o saldo inicial é opcional; sem ele não há calculado e o confirmado é digitado", async () => {
    mocks.useGetFinancialClosingNext.mockReturnValue({
      data: { ...nextOctober, isImplantation: true, previousClosingBalance: undefined },
      isLoading: false,
      isError: false,
    });
    mocks.previewFinancialClosing.mockImplementation(fakePreview(true));
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    act(() => result.current.goToBalance());

    expect(result.current.isImplantation).toBe(true);
    expect(result.current.closingBalanceText).toBe("");
    expect(result.current.balance.problem).toMatch(/Informe o saldo confirmado/);
    expect(result.current.canConfirm).toBe(false);

    act(() => result.current.setOpeningBalanceText("1727"));
    act(() => result.current.commitBalanceInputs());

    await waitFor(() => expect(result.current.closingBalanceText).toBe("5454"));
    expect(mocks.previewFinancialClosing).toHaveBeenLastCalledWith(
      expect.objectContaining({ openingBalance: 1727 }),
    );
  });

  it("confirma, invalida fechamentos (e o next), faixa e aportes, e fecha o diálogo", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper(queryClient) });

    await previewSuggested(result);
    act(() => result.current.goToBalance());
    act(() => result.current.setNotes("  Primeiro mês com saldo  "));
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    await waitFor(() => expect(result.current.open).toBe(false));
    expect(mocks.createFinancialClosing).toHaveBeenCalledWith(
      expect.objectContaining({ closingBalance: 4727, balanceNotes: null, notes: "Primeiro mês com saldo" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetFinancialClosingsQueryKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseBudgetQueryKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetCapitalContributionsQueryKey() });
  });

  it("mantém o diálogo aberto e mostra a recusa do servidor", async () => {
    mocks.createFinancialClosing.mockRejectedValue(new Error("Feche 09/2026 antes!"));
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    act(() => result.current.goToBalance());
    await act(async () => {
      result.current.handleConfirmClosing();
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao confirmar o fechamento",
          description: "Feche 09/2026 antes!",
        }),
      ),
    );
    expect(result.current.open).toBe(true);
  });

  it("voltar para a competência descarta a prévia e mantém gastos e retiradas", async () => {
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    await previewSuggested(result);
    await act(async () => {
      result.current.handleAddVariableCost(freezer);
    });
    await waitFor(() => expect(result.current.preview?.variableCosts).toHaveLength(1));
    act(() => result.current.setWithdrawal(1, "500"));

    act(() => result.current.backToCompetence());
    expect(result.current.preview).toBeNull();
    expect(result.current.canConfirm).toBe(false);

    await act(async () => {
      result.current.handleCalculatePreview();
    });

    await waitFor(() =>
      expect(mocks.previewFinancialClosing).toHaveBeenLastCalledWith(
        expect.objectContaining({
          variableCosts: [freezer],
          withdrawals: [
            { partnerId: 1, amount: 500 },
            { partnerId: 2, amount: 0 },
          ],
        }),
      ),
    );
  });

  it("sem o next (consulta falhou), sugere o último mês encerrado e não trava pela sequência", () => {
    mocks.useGetFinancialClosingNext.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { result } = renderHook(() => useNewClosing(), { wrapper: createWrapper() });

    act(() => result.current.openNewClosing());

    expect(result.current.competence.month).toBe(10);
    expect(result.current.competence.monthOptions[7]).toMatchObject({ availability: "disponivel" });
  });
});
