import { renderHook } from "@testing-library/react";
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

describe("useStockFreeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.online = true;
  });

  it("com a conferência aberta, o balcão fica impedido de vender", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({
      data: { salesPaused: true, pausedSince: "2026-09-23T18:00:00" },
    });

    const { result } = renderHook(() => useStockFreeze());

    expect(result.current).toEqual({ salesPaused: true, pausedSince: "2026-09-23T18:00:00" });
  });

  it("sem resposta ainda, não trava — a trava aparece depois, nunca antes", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: undefined });

    expect(renderHook(() => useStockFreeze()).result.current.salesPaused).toBe(false);
  });

  it("sem conexão, não consulta — e vale o último estado conhecido", () => {
    // Quem viu a conferência abrir e caiu da rede continua impedido de vender.
    mocks.online = false;
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true } });

    const { result } = renderHook(() => useStockFreeze());

    expect(mocks.useGetStockFreezeStatus).toHaveBeenCalledWith({ query: { enabled: false, retry: false } });
    expect(result.current.salesPaused).toBe(true);
  });

  it("quando a conferência encerra, a fila sobe na hora — uma vez", () => {
    // As vendas que o servidor recusou em lote (423) esperavam exatamente isto.
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true } });
    const { rerender } = renderHook(() => useStockFreeze());
    expect(mocks.syncNow).not.toHaveBeenCalled();

    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });
    rerender();
    rerender();

    expect(mocks.syncNow).toHaveBeenCalledTimes(1);
  });

  it("sem conferência nenhuma, não sincroniza por conta própria", () => {
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });
    const { rerender } = renderHook(() => useStockFreeze());
    rerender();

    expect(mocks.syncNow).not.toHaveBeenCalled();
  });
});
