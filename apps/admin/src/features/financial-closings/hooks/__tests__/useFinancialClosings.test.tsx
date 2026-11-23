import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGetCapitalContributionsQueryKey,
  getGetFinancialClosingsQueryKey,
  getGetPurchaseBudgetQueryKey,
} from "@workspace/api-client-react";
import { closingFixture } from "../../__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  useGetFinancialClosings: vi.fn(),
  useGetFinancialClosingById: vi.fn(),
  deleteFinancialClosing: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado — as chaves de cache vêm do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetFinancialClosings: mocks.useGetFinancialClosings,
  useGetFinancialClosingById: mocks.useGetFinancialClosingById,
  deleteFinancialClosing: mocks.deleteFinancialClosing,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useFinancialClosings } = await import("../useFinancialClosings");

function createWrapper(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useFinancialClosings — listagem e exclusão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetFinancialClosings.mockReturnValue({
      data: { data: [closingFixture], page: 1, limit: 10, total: 1, totalPages: 1 },
      isLoading: false,
      refetch: vi.fn(),
    });
    mocks.useGetFinancialClosingById.mockReturnValue({ data: undefined, isLoading: false });
    mocks.deleteFinancialClosing.mockResolvedValue(undefined);
  });

  it("lista sem filtro de data, do mais recente para o mais antigo", () => {
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    expect(mocks.useGetFinancialClosings).toHaveBeenCalledWith({ page: 1, limit: 10 });
    expect(result.current.closings).toEqual([closingFixture]);
    expect(result.current.detailsId).toBeNull();
  });

  it("exclui, invalida fechamentos (e o next), faixa e aportes, e fecha o detalhe", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper(queryClient) });

    act(() => result.current.openDetails(5));
    await act(async () => {
      await result.current.handleDeleteClosing(closingFixture);
    });

    expect(mocks.deleteFinancialClosing).toHaveBeenCalledWith(5);
    // O prefixo dos fechamentos alcança o `next`: o mês volta a aguardar.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetFinancialClosingsQueryKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetPurchaseBudgetQueryKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getGetCapitalContributionsQueryKey() });
    await waitFor(() => expect(result.current.detailsId).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Fechamento excluído" }));
  });

  it("mostra a recusa do servidor e propaga a falha para o ConfirmDialog ficar aberto", async () => {
    mocks.deleteFinancialClosing.mockRejectedValueOnce(
      new Error("Só o último fechamento pode ser excluído: exclua antes o de 10/2026."),
    );
    const { result } = renderHook(() => useFinancialClosings(), { wrapper: createWrapper() });

    await expect(
      act(async () => {
        await result.current.handleDeleteClosing(closingFixture);
      }),
    ).rejects.toThrow();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erro ao excluir o fechamento",
        description: "Só o último fechamento pode ser excluído: exclua antes o de 10/2026.",
      }),
    );
  });
});
