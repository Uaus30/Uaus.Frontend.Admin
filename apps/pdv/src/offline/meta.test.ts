import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetaRecord } from "./database";

const openLocalDatabase = vi.fn();
const getByKey = vi.fn();
const put = vi.fn();
const updateMany = vi.fn();

vi.mock("./database", () => ({
  openLocalDatabase: (...args: unknown[]) => openLocalDatabase(...args),
  STORE: { meta: "meta" },
  META_KEY: {
    snapshotSchemaVersion: "snapshotSchemaVersion",
    snapshotDownloadedAt: "snapshotDownloadedAt",
    snapshotGeneratedAt: "snapshotGeneratedAt",
    offlineSaleSequence: "offlineSaleSequence",
    cashRegisterSession: "cashRegisterSession",
    companySettings: "companySettings",
  },
}));

vi.mock("./idb", () => ({
  getByKey: (...args: unknown[]) => getByKey(...args),
  put: (...args: unknown[]) => put(...args),
  updateMany: (...args: unknown[]) => updateMany(...args),
}));

const { nextOfflineSaleNumber } = await import("./meta");

/**
 * Simula o `updateMany` real: uma transação readwrite que lê, muta e grava por
 * chave sobre um "banco" em memória.
 */
function updateManyBackedBy(records: Map<string, MetaRecord>) {
  updateMany.mockImplementation(
    async (
      _db: unknown,
      _store: string,
      keys: string[],
      mutate: (current: MetaRecord | null, key: string) => MetaRecord | null,
    ) => {
      for (const key of keys) {
        const next = mutate(records.get(key) ?? null, key);
        if (next !== null) records.set(key, next);
      }
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  openLocalDatabase.mockResolvedValue({});
});

describe("nextOfflineSaleNumber", () => {
  it("deve começar em 1 quando o sequencial nunca foi gravado", async () => {
    const records = new Map<string, MetaRecord>();
    updateManyBackedBy(records);

    expect(await nextOfflineSaleNumber()).toBe(1);
    expect(records.get("offlineSaleSequence")).toEqual({ key: "offlineSaleSequence", value: 1 });
  });

  it("deve reservar números sequenciais a cada chamada", async () => {
    const records = new Map<string, MetaRecord>([
      ["offlineSaleSequence", { key: "offlineSaleSequence", value: 7 }],
    ]);
    updateManyBackedBy(records);

    expect(await nextOfflineSaleNumber()).toBe(8);
    expect(await nextOfflineSaleNumber()).toBe(9);
  });

  it("deve ler e gravar numa única transação readwrite", async () => {
    // Regressão: a reserva fazia read-modify-write em DUAS transações
    // (readMeta + writeMeta); duas reservas concorrentes liam o mesmo valor e
    // imprimiam o mesmo OFF-n em cupons diferentes. A transação única do
    // `updateMany` é o que torna a alocação atômica.
    const records = new Map<string, MetaRecord>();
    updateManyBackedBy(records);

    await nextOfflineSaleNumber();

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({}, "meta", ["offlineSaleSequence"], expect.any(Function));
    // Nenhuma leitura fora da transação.
    expect(getByKey).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("deve tratar valor corrompido como sequencial zerado", async () => {
    const records = new Map<string, MetaRecord>([
      ["offlineSaleSequence", { key: "offlineSaleSequence", value: "sete" }],
    ]);
    updateManyBackedBy(records);

    expect(await nextOfflineSaleNumber()).toBe(1);
  });
});
