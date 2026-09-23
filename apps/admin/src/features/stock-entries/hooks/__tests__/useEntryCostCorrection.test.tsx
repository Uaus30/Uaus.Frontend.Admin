import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getGetPurchaseEntriesQueryKey,
  getGetPurchaseEntryDetailsQueryKey,
  getGetStockWriteOffsQueryKey,
  getProductAnomaliesQueryKey,
  type PurchaseEntryCostCorrectionDto,
} from "@workspace/api-client-react";
import { RESOURCE_KEYS } from "@/hooks/use-catalog";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useCorrectPurchaseEntryItemCost: vi.fn(),
}));

// Dubla só o que fala com a rede; as chaves de cache continuam as de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useCorrectPurchaseEntryItemCost: mocks.useCorrectPurchaseEntryItemCost,
}));

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const { useEntryCostCorrection } = await import("../useEntryCostCorrection");

const resultado: PurchaseEntryCostCorrectionDto = {
  entryId: 395,
  itemId: 7,
  productId: 10,
  previousUnitCost: 0,
  unitCost: 1.34,
  changed: true,
  saleItemsUpdated: 39,
  writeOffItemsUpdated: 0,
  affectedClosings: [],
};

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useEntryCostCorrection(), { wrapper });
  return { ...hook, invalidate };
}

describe("useEntryCostCorrection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCorrectPurchaseEntryItemCost.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    });
  });

  it("manda o item e o custo, e recarrega tudo que o custo alimenta — inclusive as anomalias", async () => {
    mocks.mutateAsync.mockResolvedValue(resultado);
    const { result, invalidate } = renderWithClient();

    await act(() => result.current.correctUnitCost({ entryId: 395, itemId: 7, unitCost: 1.34 }));

    expect(mocks.mutateAsync).toHaveBeenCalledWith({ entryId: 395, itemId: 7, data: { unitCost: 1.34 } });
    const chaves = invalidate.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(chaves).toEqual(
      expect.arrayContaining([
        getGetPurchaseEntryDetailsQueryKey(),
        getGetPurchaseEntriesQueryKey(),
        // O prefixo, e não só a variação aberta: a nota de uma compra com grade
        // traz um item por variação, e o custo de todas pode ter mudado.
        ["product-for-entry"],
        RESOURCE_KEYS.products,
        // As baixas que consumiram o lote também têm o custo refeito.
        getGetStockWriteOffsQueryKey(),
        getProductAnomaliesQueryKey(),
      ]),
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Custo corrigido",
        description: expect.stringContaining("39 itens de venda"),
      }),
    );
  });

  it("avisa, à parte, o fechamento assinado que não muda", async () => {
    mocks.mutateAsync.mockResolvedValue({
      ...resultado,
      affectedClosings: [{ id: 3, periodStart: "2026-08-01T00:00:00", periodEnd: "2026-08-31T00:00:00" }],
    });
    const { result } = renderWithClient();

    await act(() => result.current.correctUnitCost({ entryId: 395, itemId: 7, unitCost: 1.34 }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Fechamento assinado não muda", variant: "warning" }),
    );
  });

  it("recusa do servidor vira toast e REJEITA, para a confirmação continuar aberta", async () => {
    const erro = new Error("Só o custo da última entrada do produto pode ser corrigido");
    mocks.mutateAsync.mockRejectedValue(erro);
    const { result } = renderWithClient();

    await expect(
      act(() => result.current.correctUnitCost({ entryId: 395, itemId: 7, unitCost: 1.34 })),
    ).rejects.toBe(erro);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro ao corrigir o custo", variant: "destructive", error: erro }),
    );
  });
});
