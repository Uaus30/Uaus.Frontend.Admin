import { beforeEach, describe, expect, it, vi } from "vitest";

const tallyPendingSales = vi.fn();
const tallyPendingWriteOffs = vi.fn();
const syncPendingSales = vi.fn();
const syncPendingWriteOffs = vi.fn();

vi.mock("./pending-sales", () => ({
  tallyPendingSales: (...args: unknown[]) => tallyPendingSales(...args),
}));

vi.mock("./pending-write-offs", () => ({
  tallyPendingWriteOffs: (...args: unknown[]) => tallyPendingWriteOffs(...args),
}));

vi.mock("./sync", () => ({
  syncPendingSales: (...args: unknown[]) => syncPendingSales(...args),
}));

vi.mock("./write-off-sync", () => ({
  syncPendingWriteOffs: (...args: unknown[]) => syncPendingWriteOffs(...args),
}));

const { syncPendingQueues, tallyPendingQueues } = await import("./queues");

beforeEach(() => {
  vi.clearAllMocks();
  tallyPendingSales.mockResolvedValue({ pending: 1, failed: 2 });
  tallyPendingWriteOffs.mockResolvedValue({ pending: 3, failed: 4 });
  syncPendingSales.mockResolvedValue({ created: 2, duplicated: 0, rejected: 0, remaining: 0 });
  syncPendingWriteOffs.mockResolvedValue({ sent: 1, rejected: 0, remaining: 0 });
});

describe("tallyPendingQueues", () => {
  it("deve contar as duas filas separadamente", async () => {
    expect(await tallyPendingQueues()).toEqual({
      sales: { pending: 1, failed: 2 },
      writeOffs: { pending: 3, failed: 4 },
    });
  });
});

describe("syncPendingQueues", () => {
  it("deve drenar as duas filas", async () => {
    const outcome = await syncPendingQueues();

    expect(syncPendingSales).toHaveBeenCalledTimes(1);
    expect(syncPendingWriteOffs).toHaveBeenCalledTimes(1);
    expect(outcome.sales.created).toBe(2);
    expect(outcome.writeOffs.sent).toBe(1);
  });

  it("deve enviar as vendas antes das baixas", async () => {
    // Se a conexão só aguentar metade da rodada, é melhor que a metade que subiu
    // seja a que trava o fechamento do caixa.
    await syncPendingQueues();

    expect(syncPendingSales.mock.invocationCallOrder[0]).toBeLessThan(
      syncPendingWriteOffs.mock.invocationCallOrder[0],
    );
  });

  it("deve somar o que sobrou nas duas filas", async () => {
    // É o número que o fechamento de caixa consulta: qualquer movimento que o
    // servidor ainda não conhece impede o fechamento.
    syncPendingSales.mockResolvedValue({ created: 0, duplicated: 0, rejected: 1, remaining: 1 });
    syncPendingWriteOffs.mockResolvedValue({ sent: 0, rejected: 2, remaining: 2 });

    expect((await syncPendingQueues()).remaining).toBe(3);
  });
});
