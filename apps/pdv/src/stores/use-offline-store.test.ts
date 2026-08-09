import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueSyncOutcome } from "@/offline";

const readLocalDatabaseState = vi.fn();
const refreshLocalDatabase = vi.fn();
const syncPendingQueues = vi.fn();
const tallyPendingQueues = vi.fn();

vi.mock("@/offline", () => ({
  readLocalDatabaseState: (...args: unknown[]) => readLocalDatabaseState(...args),
  refreshLocalDatabase: (...args: unknown[]) => refreshLocalDatabase(...args),
  syncPendingQueues: (...args: unknown[]) => syncPendingQueues(...args),
  tallyPendingQueues: (...args: unknown[]) => tallyPendingQueues(...args),
}));

const { useOfflineStore } = await import("./use-offline-store");

/** Resumo de uma rodada que enviou uma venda. */
function outcome(): QueueSyncOutcome {
  return {
    sales: { created: 1, duplicated: 0, rejected: 0, remaining: 0 },
    writeOffs: { sent: 0, rejected: 0, remaining: 0 },
    remaining: 0,
  };
}

/** Contagem das filas: uma venda pendente. */
function tallyWithPending() {
  return {
    sales: { pending: 1, failed: 0 },
    writeOffs: { pending: 0, failed: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOfflineStore.getState().reset();
  useOfflineStore.setState({ online: true, connectionChecked: true });

  tallyPendingQueues.mockResolvedValue(tallyWithPending());
  syncPendingQueues.mockResolvedValue(outcome());
  readLocalDatabaseState.mockResolvedValue({
    downloadedAt: "2026-08-08T10:00:00.000Z",
    generatedAt: "2026-08-08T10:00:00.000Z",
    schemaVersion: 1,
  });
  refreshLocalDatabase.mockResolvedValue({
    products: 1,
    paymentMethods: 1,
    customers: 0,
    generatedAt: "2026-08-08T10:00:00.000Z",
  });
});

describe("syncNow", () => {
  it("não deve sincronizar sem conexão", async () => {
    useOfflineStore.setState({ online: false });

    expect(await useOfflineStore.getState().syncNow()).toBeNull();
    expect(syncPendingQueues).not.toHaveBeenCalled();
  });

  it("não deve sincronizar com a fila vazia", async () => {
    tallyPendingQueues.mockResolvedValue({
      sales: { pending: 0, failed: 0 },
      writeOffs: { pending: 0, failed: 0 },
    });

    expect(await useOfflineStore.getState().syncNow()).toBeNull();
    expect(syncPendingQueues).not.toHaveBeenCalled();
  });

  it("deve marcar syncing de forma síncrona, antes de qualquer await", () => {
    // Regressão da corrida TOCTOU: a flag só era gravada DEPOIS do
    // `await refreshCounts()`, e um segundo chamador passava pela guarda
    // enquanto o primeiro estava suspenso.
    const round = useOfflineStore.getState().syncNow();

    expect(useOfflineStore.getState().syncing).toBe(true);
    return round;
  });

  it("deve compartilhar a mesma rodada entre chamadores concorrentes", async () => {
    // Regressão: duas chamadas quase simultâneas (watcher de reconexão +
    // fechamento de caixa) drenavam a mesma fila em paralelo, duplicando os
    // efeitos locais — restoreLocalStock 2x numa recusa, consumeLocalStock 2x
    // numa venda reenfileirada que entrou.
    const first = useOfflineStore.getState().syncNow();
    const second = useOfflineStore.getState().syncNow();

    const [a, b] = await Promise.all([first, second]);

    expect(syncPendingQueues).toHaveBeenCalledTimes(1);
    expect(a).toEqual(outcome());
    expect(b).toBe(a);
  });

  it("deve liberar a próxima rodada quando a atual termina", async () => {
    await useOfflineStore.getState().syncNow();
    await useOfflineStore.getState().syncNow();

    expect(syncPendingQueues).toHaveBeenCalledTimes(2);
    expect(useOfflineStore.getState().syncing).toBe(false);
  });

  it("deve desligar syncing mesmo quando a rodada falha", async () => {
    syncPendingQueues.mockRejectedValueOnce(new Error("falha inesperada"));

    await expect(useOfflineStore.getState().syncNow()).rejects.toThrow("falha inesperada");
    expect(useOfflineStore.getState().syncing).toBe(false);

    // E a rodada seguinte volta a rodar normalmente — a promise em voo não
    // pode ficar presa numa rodada que já morreu.
    expect(await useOfflineStore.getState().syncNow()).toEqual(outcome());
  });
});

describe("refreshSnapshot", () => {
  it("deve drenar a fila pendente antes de baixar o snapshot", async () => {
    // Regressão: o snapshot era instalado com a fila pendente ainda no
    // navegador — o GET capturava o estoque do servidor sem as vendas da fila
    // e o débito local delas se perdia.
    await useOfflineStore.getState().refreshSnapshot(7);

    expect(syncPendingQueues).toHaveBeenCalledTimes(1);
    expect(refreshLocalDatabase).toHaveBeenCalledTimes(1);

    const syncOrder = syncPendingQueues.mock.invocationCallOrder[0];
    const refreshOrder = refreshLocalDatabase.mock.invocationCallOrder[0];
    expect(syncOrder).toBeLessThan(refreshOrder);
  });

  it("deve registrar a sessão do snapshot baixado", async () => {
    await useOfflineStore.getState().refreshSnapshot(7);

    expect(useOfflineStore.getState().snapshotSessionId).toBe(7);
  });

  it("deve registrar o erro quando o download falha", async () => {
    refreshLocalDatabase.mockRejectedValueOnce(new Error("API fora do ar"));

    const result = await useOfflineStore.getState().refreshSnapshot(7);

    expect(result).toBeNull();
    expect(useOfflineStore.getState().snapshotError).toBe("API fora do ar");
    expect(useOfflineStore.getState().refreshingSnapshot).toBe(false);
  });
});
