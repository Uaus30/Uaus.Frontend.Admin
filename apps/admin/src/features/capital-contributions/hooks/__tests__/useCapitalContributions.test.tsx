import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGetCapitalContributionsQueryKey,
  getGetPurchaseBudgetQueryKey,
  type CapitalContributionDto,
} from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetCapitalContributions: vi.fn(),
  useGetCapitalContributionTotalsByPartner: vi.fn(),
  useGetPartners: vi.fn(),
  createCapitalContribution: vi.fn(),
  updateCapitalContribution: vi.fn(),
  deleteCapitalContribution: vi.fn(),
  getPurchaseBudget: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL:
// o teste de invalidação tem que conferir a chave que a tela usa.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCapitalContributions: mocks.useGetCapitalContributions,
  useGetCapitalContributionTotalsByPartner: mocks.useGetCapitalContributionTotalsByPartner,
  useGetPartners: mocks.useGetPartners,
  createCapitalContribution: mocks.createCapitalContribution,
  updateCapitalContribution: mocks.updateCapitalContribution,
  deleteCapitalContribution: mocks.deleteCapitalContribution,
  getPurchaseBudget: mocks.getPurchaseBudget,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useCapitalContributions } = await import("../useCapitalContributions");

const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

const aporte: CapitalContributionDto = {
  id: 7,
  partnerId: 2,
  partnerName: "Bruno",
  contributionDate: "2026-11-10T00:00:00",
  amount: 500,
  notes: "Natal",
  createdAt: "2026-11-10T09:00:00",
  createdBy: "Wagner",
};

function createWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useCapitalContributions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 23, 10, 0));
    window.history.replaceState(null, "", "/financeiro/aportes");

    mocks.useGetCapitalContributions.mockReturnValue({
      data: { month: "2026-11", isClosed: false, total: 500, items: [aporte] },
      isLoading: false,
    });
    mocks.useGetCapitalContributionTotalsByPartner.mockReturnValue({ data: [], isLoading: false });
    mocks.useGetPartners.mockReturnValue({
      data: {
        data: [
          { id: 2, name: "Bruno", isActive: true, profitSharePercentage: 50, createdAt: "" },
          { id: 1, name: "Ana", isActive: true, profitSharePercentage: 50, createdAt: "" },
          { id: 3, name: "Carla", isActive: false, profitSharePercentage: 0, createdAt: "" },
        ],
        page: 1,
        limit: 100,
        total: 3,
        totalPages: 1,
      },
      isLoading: false,
    });
    mocks.createCapitalContribution.mockResolvedValue(aporte);
    mocks.updateCapitalContribution.mockResolvedValue(aporte);
    mocks.deleteCapitalContribution.mockResolvedValue(undefined);
    // Antes do aporte, amarelo; depois, verde.
    mocks.getPurchaseBudget
      .mockResolvedValueOnce({ month: "2026-11", band: "Yellow" })
      .mockResolvedValueOnce({ month: "2026-11", band: "Green" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("abre no mês corrente, com os sócios ativos em ordem alfabética", () => {
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    expect(result.current.month).toBe("2026-11");
    expect(mocks.useGetCapitalContributions).toHaveBeenCalledWith({ month: "2026-11" });
    expect(result.current.partnerOptions).toEqual([
      { id: 1, name: "Ana" },
      { id: 2, name: "Bruno" },
    ]);
    expect(result.current.modalOpen).toBe(false);
  });

  it("chegando pelo atalho do Painel (?novo=1), a modal já abre com a data de hoje", () => {
    window.history.replaceState(null, "", "/financeiro/aportes?novo=1");

    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    expect(result.current.modalOpen).toBe(true);
    expect(result.current.form.contributionDate).toBe("2026-11-23");

    act(() => result.current.closeModal());
    // Sem tirar o parâmetro, um F5 reabriria a modal vazia.
    expect(window.location.search).toBe("");
  });

  it("lança o aporte, invalida aportes e faixa, e o toast diz o efeito na faixa", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper(queryClient) });

    act(() => result.current.openCreate());
    act(() =>
      result.current.setForm({ ...result.current.form, partnerId: "1", amount: "750.5", notes: " " }),
    );
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.createCapitalContribution).toHaveBeenCalledWith({
        partnerId: 1,
        contributionDate: "2026-11-23",
        amount: 750.5,
        notes: null,
      }),
    );
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Aporte lançado.",
        description: "Novembro passou de amarelo para verde.",
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetCapitalContributionsQueryKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseBudgetQueryKey() });
    expect(mocks.getPurchaseBudget).toHaveBeenCalledWith({ month: "2026-11" });
    expect(result.current.modalOpen).toBe(false);
  });

  it("não vai à rede sem sócio ou com valor zero", async () => {
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    act(() => result.current.openCreate());
    act(() => result.current.setForm({ ...result.current.form, partnerId: "1", amount: "0" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });
    act(() => result.current.setForm({ ...result.current.form, partnerId: "", amount: "100" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    expect(mocks.createCapitalContribution).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Preencha os campos obrigatórios", variant: "destructive" }),
    );
  });

  it("edita pelo PUT com o id do aporte aberto", async () => {
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    act(() => result.current.openEdit(aporte));
    expect(result.current.form).toEqual({
      contributionDate: "2026-11-10",
      partnerId: "2",
      amount: "500",
      notes: "Natal",
    });
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.updateCapitalContribution).toHaveBeenCalledWith(7, {
        partnerId: 2,
        contributionDate: "2026-11-10",
        amount: 500,
        notes: "Natal",
      }),
    );
  });

  it("na edição, o sócio do aporte aparece no select mesmo inativo", () => {
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    act(() => result.current.openEdit({ ...aporte, partnerId: 3, partnerName: "Carla" }));

    expect(result.current.partnerOptions.map((partner) => partner.name)).toEqual(["Ana", "Bruno", "Carla"]);
  });

  it("mostra o erro do servidor e mantém a modal aberta quando o mês está fechado", async () => {
    mocks.createCapitalContribution.mockRejectedValue(
      new Error("O mês de 10/2026 já foi fechado: aporte nele não pode ser lançado, alterado nem excluído!"),
    );
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    act(() => result.current.openCreate());
    act(() => result.current.setForm({ ...result.current.form, partnerId: "1", amount: "100" }));
    await act(async () => {
      result.current.handleSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao salvar o aporte",
          description:
            "O mês de 10/2026 já foi fechado: aporte nele não pode ser lançado, alterado nem excluído!",
        }),
      ),
    );
    expect(result.current.modalOpen).toBe(true);
  });

  it("exclui e diz o efeito; a falha propaga para o ConfirmDialog ficar aberto", async () => {
    mocks.getPurchaseBudget.mockReset();
    mocks.getPurchaseBudget
      .mockResolvedValueOnce({ month: "2026-11", band: "Green" })
      .mockResolvedValueOnce({ month: "2026-11", band: "Green" });
    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.handleDelete(aporte);
    });

    expect(mocks.deleteCapitalContribution).toHaveBeenCalledWith(7);
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Aporte excluído.",
        description: "Novembro continua verde.",
      }),
    );

    mocks.deleteCapitalContribution.mockRejectedValueOnce(new Error("500"));
    await expect(
      act(async () => {
        await result.current.handleDelete(aporte);
      }),
    ).rejects.toThrow();
  });

  it("expõe o mês fechado para a tela travar os botões", () => {
    mocks.useGetCapitalContributions.mockReturnValue({
      data: { month: "2026-10", isClosed: true, total: 0, items: [] },
      isLoading: false,
    });

    const { result } = renderHook(() => useCapitalContributions(), { wrapper: createWrapper() });

    expect(result.current.isClosed).toBe(true);
  });
});
