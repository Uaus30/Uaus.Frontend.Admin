import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGetInventoryCountsQueryKey,
  getGetStockFreezeStatusQueryKey,
  type InventoryCountDto,
} from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetInventoryCountProductState: vi.fn(),
  reviewInventoryCountProduct: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
}));

// Só o que fala com a rede é dublado; chaves de cache e enums vêm do módulo REAL.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetInventoryCountProductState: mocks.useGetInventoryCountProductState,
  reviewInventoryCountProduct: mocks.reviewInventoryCountProduct,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/produtos/12", mocks.navigate],
}));

const { ProductConferenceBanner } = await import("../ProductConferenceBanner");

/** A rodada como o servidor a devolve depois da marcação. */
function rodada(extras: Partial<InventoryCountDto> = {}): InventoryCountDto {
  return {
    id: 8,
    status: "Open",
    statusName: "Em andamento",
    startedAt: "2026-09-23T09:00:00",
    totalItems: 40,
    reviewedItems: 39,
    pendingItems: 1,
    ...extras,
  };
}

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <ProductConferenceBanner productGroupId={12} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("ProductConferenceBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetInventoryCountProductState.mockReturnValue({
      data: { inCount: true, reviewed: false, lastReviewedAt: "2026-09-01T10:00:00" },
    });
  });

  it("mostra quando o cadastro foi conferido pela última vez, numa rodada anterior", () => {
    renderBanner();

    expect(screen.getByTestId("product-conference-banner").textContent).toMatch(
      /Última conferência: 01\/09\/2026/,
    );
  });

  it("marcar o último conferido encerra a rodada e solta o estoque na hora", async () => {
    // Sem invalidar o congelamento, a faixa do topo e os botões de entrada
    // continuariam travados até a próxima consulta, 30 segundos depois.
    mocks.reviewInventoryCountProduct.mockResolvedValue(
      rodada({ status: "Finished", statusName: "Encerrada", reviewedItems: 40, pendingItems: 0 }),
    );
    const { invalidate } = renderBanner();

    fireEvent.click(screen.getByRole("button", { name: /Marcar como conferido/i }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getGetInventoryCountsQueryKey() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getGetStockFreezeStatusQueryKey() });
    expect(mocks.toast.mock.calls[0][0].description).toMatch(/vendas estão liberadas/);
  });

  it("fora de conferência não aparece", () => {
    mocks.useGetInventoryCountProductState.mockReturnValue({ data: { inCount: false, reviewed: false } });

    renderBanner();

    expect(screen.queryByTestId("product-conference-banner")).toBeNull();
  });
});
