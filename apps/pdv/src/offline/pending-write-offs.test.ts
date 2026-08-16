import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDatabase } from "@/test/local-database";
import {
  listPendingWriteOffs,
  listWriteOffsToSync,
  markPendingWriteOffAttempted,
  markPendingWriteOffFailed,
  removePendingWriteOff,
  retryPendingWriteOff,
  savePendingWriteOff,
  tallyPendingWriteOffs,
} from "./pending-write-offs";
import type { PendingWriteOff } from "./types";

/**
 * A fila de baixas de estoque offline, contra um IndexedDB de verdade.
 *
 * A baixa mora numa store própria, mas **compartilha a mecânica** da fila de
 * vendas de propósito: chave primária `clientReference` (que é a chave de
 * idempotência da API), marcador `stockApplied` e recusa que não é retentada
 * sozinha. Estes testes cobrem essa mecânica no banco — o envio em si, com os
 * status HTTP, está em `write-off-sync.test.ts`.
 */

/** Baixa da fila: perda de 2 unidades do produto 1. */
function pendingWriteOff(reference: string, overrides: Partial<PendingWriteOff> = {}): PendingWriteOff {
  return {
    clientReference: reference,
    occurredAt: "2026-08-15T17:34:12",
    // Perda, no enum `StockWriteOffReason` do backend.
    reason: 2,
    notes: null,
    items: [{ productId: 1, quantity: 2, productName: "Café" }],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/** Uma baixa da fila pela referência, ou `undefined` se ela não está mais lá. */
async function findQueued(reference: string): Promise<PendingWriteOff | undefined> {
  return (await listPendingWriteOffs()).find((writeOff) => writeOff.clientReference === reference);
}

beforeEach(() => {
  resetLocalDatabase();
});

describe("idempotência da fila de baixas", () => {
  it("deve manter uma linha só quando a mesma baixa é gravada duas vezes", async () => {
    // A referência é a do rascunho do diálogo, não da tentativa: reenviar o
    // mesmo formulário depois de uma falha de rede não pode virar duas baixas
    // na fila, que o servidor gravaria como duas saídas de mercadoria.
    await savePendingWriteOff(pendingWriteOff("baixa-1"));
    await savePendingWriteOff(pendingWriteOff("baixa-1", { notes: "corrigida" }));

    expect(await listPendingWriteOffs()).toHaveLength(1);
    expect((await findQueued("baixa-1"))?.notes).toBe("corrigida");
  });

  it("não deve criar linha nova ao registrar uma tentativa da mesma baixa", async () => {
    const writeOff = pendingWriteOff("baixa-1");
    await savePendingWriteOff(writeOff);

    await markPendingWriteOffAttempted(writeOff);

    expect(await listPendingWriteOffs()).toHaveLength(1);
    expect(await findQueued("baixa-1")).toMatchObject({ status: "pending", attempts: 1 });
  });

  it("deve devolver as baixas da mais antiga para a mais nova", async () => {
    // Mesma razão da fila de vendas: as baixas disputam o mesmo estoque.
    await savePendingWriteOff(pendingWriteOff("baixa-2", { occurredAt: "2026-08-15T18:00:00" }));
    await savePendingWriteOff(pendingWriteOff("baixa-1", { occurredAt: "2026-08-15T17:00:00" }));

    expect((await listPendingWriteOffs()).map((item) => item.clientReference)).toEqual([
      "baixa-1",
      "baixa-2",
    ]);
  });
});

describe("recusa e reenvio da baixa", () => {
  it("deve gravar o motivo da recusa e desmarcar o débito de estoque", async () => {
    const writeOff = pendingWriteOff("baixa-1");
    await savePendingWriteOff(writeOff);

    await markPendingWriteOffFailed(writeOff, "Produto excluído!");

    expect(await findQueued("baixa-1")).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "Produto excluído!",
      stockApplied: false,
    });
  });

  it("não deve reenviar automaticamente a baixa recusada", async () => {
    await savePendingWriteOff(pendingWriteOff("baixa-1"));
    await markPendingWriteOffFailed(pendingWriteOff("baixa-1"), "Produto excluído!");
    await savePendingWriteOff(pendingWriteOff("baixa-2"));

    expect((await listWriteOffsToSync()).map((item) => item.clientReference)).toEqual(["baixa-2"]);
  });

  it("deve devolver a baixa recusada para o reenvio sem apagar o marcador de estoque", async () => {
    // Igual à venda: o saldo local foi devolvido na recusa, e só o marcador faz
    // o redébito acontecer quando a baixa finalmente entrar.
    const writeOff = pendingWriteOff("baixa-1");
    await savePendingWriteOff(writeOff);
    await markPendingWriteOffFailed(writeOff, "Produto excluído!");

    await retryPendingWriteOff((await findQueued("baixa-1")) as PendingWriteOff);

    expect(await findQueued("baixa-1")).toMatchObject({
      status: "pending",
      lastError: null,
      stockApplied: false,
    });
  });

  it("deve contar a fila por situação e esvaziar na remoção", async () => {
    await savePendingWriteOff(pendingWriteOff("baixa-1"));
    await savePendingWriteOff(pendingWriteOff("baixa-2"));
    await markPendingWriteOffFailed(pendingWriteOff("baixa-2"), "Recusada!");

    expect(await tallyPendingWriteOffs()).toEqual({ pending: 1, failed: 1 });

    await removePendingWriteOff("baixa-1");
    await removePendingWriteOff("baixa-2");

    expect(await tallyPendingWriteOffs()).toEqual({ pending: 0, failed: 0 });
  });
});
