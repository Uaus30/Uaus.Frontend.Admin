import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ toast: vi.fn(), sync: vi.fn() }));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/use-offline-pdv", () => ({
  useOfflinePdv: () => ({
    sync: mocks.sync,
    updateLocalDatabase: vi.fn(),
    refreshCounts: vi.fn(),
    snapshotError: null,
    online: true,
  }),
}));

vi.mock("@/offline", () => ({
  listPendingSales: vi.fn().mockResolvedValue([]),
  listPendingWriteOffs: vi.fn().mockResolvedValue([]),
  removePendingSale: vi.fn(),
  removePendingWriteOff: vi.fn(),
  retryPendingSale: vi.fn(),
  retryPendingWriteOff: vi.fn(),
}));

const { useOfflineQueue } = await import("../use-offline-queue");

/** Desfecho de uma rodada em que nada subiu e nada foi recusado. */
function nadaSubiu(blockedByStockFreeze: boolean) {
  return {
    sales: { created: 0, duplicated: 0, rejected: 0, remaining: 2 },
    writeOffs: { sent: 0, rejected: 0, remaining: 1 },
    remaining: 3,
    blockedByStockFreeze,
  };
}

describe("useOfflineQueue — o aviso do Sincronizar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("com a conferência de estoque aberta, avisa em âmbar para esperar o encerramento", async () => {
    // Era o defeito: o lote recusado inteiro (423) aparecia como "Fila
    // sincronizada", em verde, e o operador não tinha o que fazer.
    mocks.sync.mockResolvedValue(nadaSubiu(true));
    const { result } = renderHook(() => useOfflineQueue({ sessionId: 1 }));

    await act(() => result.current.syncNow());

    const aviso = mocks.toast.mock.calls.at(-1)?.[0];
    expect(aviso.title).toBe("Fila aguardando a conferência de estoque");
    expect(aviso.variant).toBe("warning");
    expect(aviso.description).toMatch(/sobem sozinhas quando ela for encerrada/);
  });

  it("com a conexão caindo no meio, também não diz que sincronizou", async () => {
    mocks.sync.mockResolvedValue(nadaSubiu(false));
    const { result } = renderHook(() => useOfflineQueue({ sessionId: 1 }));

    await act(() => result.current.syncNow());

    const aviso = mocks.toast.mock.calls.at(-1)?.[0];
    expect(aviso.title).toBe("A fila não subiu");
    expect(aviso.variant).toBe("warning");
  });

  it("o que subiu de fato continua em verde", async () => {
    mocks.sync.mockResolvedValue({
      sales: { created: 2, duplicated: 0, rejected: 0, remaining: 0 },
      writeOffs: { sent: 0, rejected: 0, remaining: 0 },
      remaining: 0,
      blockedByStockFreeze: false,
    });
    const { result } = renderHook(() => useOfflineQueue({ sessionId: 1 }));

    await act(() => result.current.syncNow());

    const aviso = mocks.toast.mock.calls.at(-1)?.[0];
    expect(aviso.title).toBe("Fila sincronizada");
    expect(String(aviso.className)).toContain("emerald");
  });
});
