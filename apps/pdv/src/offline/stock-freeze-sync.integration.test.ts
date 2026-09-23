import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@workspace/api-client-react";
import { resetLocalDatabase } from "@/test/local-database";
import { STORE, openLocalDatabase } from "@/offline/database";
import { getByKey, putAll } from "@/offline/idb";
import { listPendingSales, savePendingSale } from "@/offline/pending-sales";
import { listPendingWriteOffs, savePendingWriteOff } from "@/offline/pending-write-offs";
import { consumeLocalStock } from "@/offline/stock";
import type { LocalProduct, PendingSale, PendingWriteOff } from "@/offline/types";

const mocks = vi.hoisted(() => ({ apiPost: vi.fn(), registerStockWriteOff: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  apiPost: (...args: unknown[]) => mocks.apiPost(...args),
  registerStockWriteOff: (...args: unknown[]) => mocks.registerStockWriteOff(...args),
}));

const { syncPendingQueues } = await import("@/offline/queues");

const CONFERENCIA =
  "Conferência de estoque em andamento: vendas, cancelamentos, entradas e baixas estão pausados até a conferência ser encerrada.";

const venda: PendingSale = {
  clientReference: "checkout-1",
  offlineNumber: 1,
  occurredAt: "2026-09-23T17:34:12",
  cashRegisterSessionId: 7,
  customerId: null,
  customerDocument: null,
  total: 75,
  discount: 0,
  notes: null,
  items: [{ productId: 1, quantity: 3, unitPrice: 25, productName: "Café" }],
  payments: [],
  status: "pending",
  attempts: 0,
  lastError: null,
  stockApplied: true,
};

const baixa: PendingWriteOff = {
  clientReference: "baixa-1",
  occurredAt: "2026-09-23T17:40:00",
  reason: 2,
  notes: null,
  items: [{ productId: 1, quantity: 1, productName: "Café" }],
  status: "pending",
  attempts: 0,
  lastError: null,
  stockApplied: true,
};

async function storedStock(): Promise<number | undefined> {
  const db = await openLocalDatabase();
  return (await getByKey<LocalProduct>(db, STORE.products, 1))?.stock;
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetLocalDatabase();
  const db = await openLocalDatabase();
  await putAll<LocalProduct>(db, STORE.products, [
    {
      id: 1,
      name: "Café",
      barcode: "789",
      price: 25,
      stock: 10,
      status: 2,
      productGroupId: 1,
      searchName: "cafe",
    },
  ]);
  await consumeLocalStock([{ productId: 1, quantity: 3 }]);
  await savePendingSale(venda);
  await consumeLocalStock([{ productId: 1, quantity: 1 }]);
  await savePendingWriteOff(baixa);
});

describe("fila offline com a conferência de estoque aberta (423)", () => {
  it("venda e baixa continuam pendentes, com o estoque local ainda debitado, e o desfecho diz por quê", async () => {
    mocks.apiPost.mockRejectedValue(new ApiError(CONFERENCIA, 423, { message: CONFERENCIA }));
    mocks.registerStockWriteOff.mockRejectedValue(new ApiError(CONFERENCIA, 423, { message: CONFERENCIA }));

    const outcome = await syncPendingQueues();

    expect(outcome.sales).toMatchObject({ created: 0, duplicated: 0, rejected: 0, remaining: 1 });
    expect(outcome.writeOffs).toMatchObject({ sent: 0, rejected: 0, remaining: 1 });
    // É o que deixa a tela dizer "espere a conferência" em vez de "sincronizada" —
    // e cada fila diz o seu.
    expect(outcome.blockedByStockFreeze).toBe(true);
    expect(outcome.sales.blockedByStockFreeze).toBe(true);
    expect(outcome.writeOffs.blockedByStockFreeze).toBe(true);
    expect((await listPendingSales())[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      stockApplied: true,
    });
    expect((await listPendingWriteOffs())[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      stockApplied: true,
    });
    // Nada devolvido ao estoque local: a mercadoria saiu da prateleira.
    expect(await storedStock()).toBe(6);
  });

  it("a queda de rede no meio não é confundida com a conferência", async () => {
    mocks.apiPost.mockRejectedValue(new TypeError("Failed to fetch"));
    mocks.registerStockWriteOff.mockRejectedValue(new TypeError("Failed to fetch"));

    const outcome = await syncPendingQueues();

    expect(outcome.remaining).toBe(2);
    expect(outcome.blockedByStockFreeze).toBe(false);
  });
});
