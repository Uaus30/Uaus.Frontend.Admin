import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useGetStockFreezeStatus: vi.fn(), syncNow: vi.fn(), online: true }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockFreezeStatus: mocks.useGetStockFreezeStatus,
}));

vi.mock("@/stores/use-offline-store", () => ({
  useOfflineStore: (selector: (state: { online: boolean; syncNow: () => void }) => unknown) =>
    selector({ online: mocks.online, syncNow: mocks.syncNow }),
}));

const { useStockFreeze } = await import("../use-stock-freeze");

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Object.assign(wrapper, { queryClient });
}

/** Deixa a promessa das rodadas de sincronização terminar. */
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

describe("useStockFreeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.online = true;
    mocks.syncNow.mockResolvedValue(null);
  });

  it("com a conferência aberta, o balcão fica impedido de vender", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({
      data: { salesPaused: true, pausedSince: "2026-09-23T18:00:00" },
    });

    const { result } = renderHook(() => useStockFreeze(), { wrapper: createWrapper() });

    expect(result.current).toEqual({ salesPaused: true, pausedSince: "2026-09-23T18:00:00" });
  });

  it("sem resposta ainda, não trava — a trava aparece depois, nunca antes", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: undefined });

    expect(renderHook(() => useStockFreeze(), { wrapper: createWrapper() }).result.current.salesPaused).toBe(
      false,
    );
  });

  it("sem conexão, não consulta — e vale o último estado conhecido", () => {
    // Quem viu a conferência abrir e caiu da rede continua impedido de vender.
    mocks.online = false;
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true } });

    const { result } = renderHook(() => useStockFreeze(), { wrapper: createWrapper() });

    expect(mocks.useGetStockFreezeStatus).toHaveBeenCalledWith({ query: { enabled: false, retry: false } });
    expect(result.current.salesPaused).toBe(true);
  });

  it("quando a conferência encerra, a fila sobe na hora — duas rodadas, uma vez só", async () => {
    // As vendas que o servidor recusou em lote (423) esperavam exatamente isto.
    // A segunda rodada pega o caso da sincronização que já estava em voo.
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true } });
    const { rerender } = renderHook(() => useStockFreeze(), { wrapper: createWrapper() });
    expect(mocks.syncNow).not.toHaveBeenCalled();

    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });
    rerender();
    rerender();
    await flush();

    expect(mocks.syncNow).toHaveBeenCalledTimes(2);
  });

  it("recarrega as telas quando alguma venda ou baixa subiu", async () => {
    mocks.syncNow
      .mockResolvedValueOnce({ sales: { created: 2 }, writeOffs: { sent: 0 } })
      .mockResolvedValueOnce(null);
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true } });
    const wrapper = createWrapper();
    const invalidate = vi.spyOn(wrapper.queryClient, "invalidateQueries");
    const { rerender } = renderHook(() => useStockFreeze(), { wrapper });

    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });
    rerender();
    await flush();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("sem conferência nenhuma, não sincroniza por conta própria", async () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });
    const { rerender } = renderHook(() => useStockFreeze(), { wrapper: createWrapper() });
    rerender();
    await flush();

    expect(mocks.syncNow).not.toHaveBeenCalled();
  });
});
