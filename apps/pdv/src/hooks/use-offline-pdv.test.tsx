import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshSnapshot = vi.fn();
const refreshSnapshotState = vi.fn();
const refreshCounts = vi.fn();
const syncNow = vi.fn();

let mockState = {
  online: true,
  connectionChecked: true,
  syncing: false,
  refreshingSnapshot: false,
  pending: 0,
  failed: 0,
  pendingWriteOffs: 0,
  failedWriteOffs: 0,
  snapshot: null as { downloadedAt: string; generatedAt: string; schemaVersion: number } | null,
  snapshotChecked: false,
  snapshotError: null,
  lastSync: null,
  snapshotSessionId: null as number | null,
  refreshSnapshot,
  refreshSnapshotState,
  refreshCounts,
  syncNow,
};

vi.mock("@/stores/use-offline-store", () => ({
  useOfflineStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

const { useOfflinePdv } = await import("./use-offline-pdv");

beforeEach(() => {
  vi.clearAllMocks();
  mockState = {
    online: true,
    connectionChecked: true,
    syncing: false,
    refreshingSnapshot: false,
    pending: 0,
    failed: 0,
    pendingWriteOffs: 0,
    failedWriteOffs: 0,
    snapshot: null,
    snapshotChecked: false,
    snapshotError: null,
    lastSync: null,
    snapshotSessionId: null,
    refreshSnapshot,
    refreshSnapshotState,
    refreshCounts,
    syncNow,
  };
});

describe("useOfflinePdv", () => {
  it("deve carregar o estado do snapshot ao montar", () => {
    renderHook(() => useOfflinePdv(null));

    expect(refreshSnapshotState).toHaveBeenCalledTimes(1);
  });

  it("não deve disparar refreshSnapshot antes de snapshotChecked ser true", () => {
    mockState.snapshotChecked = false;
    mockState.snapshot = null;

    renderHook(() => useOfflinePdv(null));

    expect(refreshSnapshot).not.toHaveBeenCalled();
  });

  it("deve disparar refreshSnapshot quando a base local não for de hoje", () => {
    mockState.snapshotChecked = true;
    mockState.snapshot = {
      downloadedAt: "2026-08-01T10:00:00.000Z",
      generatedAt: "2026-08-01T10:00:00.000Z",
      schemaVersion: 1,
    };

    renderHook(() => useOfflinePdv(null));

    expect(refreshSnapshot).toHaveBeenCalledWith(null);
  });

  it("não deve disparar refreshSnapshot se o snapshot for de hoje e a sessão for a mesma", () => {
    mockState.snapshotChecked = true;
    mockState.snapshot = {
      downloadedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    mockState.snapshotSessionId = 5;

    renderHook(() => useOfflinePdv(5));

    expect(refreshSnapshot).not.toHaveBeenCalled();
  });

  it("não deve disparar refreshSnapshot quando estiver offline", () => {
    mockState.online = false;
    mockState.snapshotChecked = true;
    mockState.snapshot = null;

    renderHook(() => useOfflinePdv(null));

    expect(refreshSnapshot).not.toHaveBeenCalled();
  });

  it("sync deve delegar para syncNow do store", async () => {
    syncNow.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useOfflinePdv(null));

    await result.current.sync();

    expect(syncNow).toHaveBeenCalledTimes(1);
  });

  it("updateLocalDatabase deve forçar refreshSnapshot com o sessionId atual", () => {
    const { result } = renderHook(() => useOfflinePdv(10));

    result.current.updateLocalDatabase();

    expect(refreshSnapshot).toHaveBeenCalledWith(10);
  });
});
