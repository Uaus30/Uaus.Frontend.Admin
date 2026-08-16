import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLocalDatabase } from "@/test/local-database";
import { STORE, openLocalDatabase } from "./database";
import { getByKey, putAll } from "./idb";
import { listPendingSales, retryPendingSale, savePendingSale } from "./pending-sales";
import { consumeLocalStock } from "./stock";
import type { LocalProduct, PendingSale, SaleSyncStatus } from "./types";

/**
 * A drenagem da fila de vendas contra um IndexedDB de verdade.
 *
 * `sync.test.ts` cobre a decisão sobre cada desfecho com a fila dublada. O que
 * só aparece aqui é o efeito acumulado no banco: a venda que **sai** da fila, o
 * saldo local que volta na recusa, o marcador `stockApplied` sobrevivendo entre
 * uma rodada e a seguinte. É onde se prova que sincronizar duas vezes não grava
 * duas vendas — a chave é a do checkout, e a segunda rodada não encontra mais
 * nada para enviar.
 */

const apiPost = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  apiPost: (...args: unknown[]) => apiPost(...args),
}));

const { syncPendingSales, SYNC_BATCH_SIZE } = await import("./sync");

/** O corpo que o PDV manda para `POST /Pdv/sales/sync`. */
interface SyncRequestBody {
  sales: Array<{ clientReference: string }>;
}

/** Venda da fila, debitando `quantity` do produto 1. */
function pendingSale(reference: string, quantity = 3, overrides: Partial<PendingSale> = {}): PendingSale {
  return {
    clientReference: reference,
    offlineNumber: 1,
    occurredAt: "2026-08-15T17:34:12",
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 25 * quantity,
    discount: 0,
    notes: null,
    items: [{ productId: 1, quantity, unitPrice: 25, productName: "Café" }],
    payments: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/**
 * Faz o servidor responder o mesmo desfecho para toda venda do lote, montando a
 * resposta a partir das referências que chegaram — como o backend faz.
 */
function serverAnswers(status: SaleSyncStatus, message: string | null = null): void {
  apiPost.mockImplementation((_path: string, body: SyncRequestBody) =>
    Promise.resolve({
      data: {
        results: body.sales.map((sale) => ({
          clientReference: sale.clientReference,
          status,
          saleId: status === "Rejected" ? null : 900,
          message,
        })),
      },
    }),
  );
}

/** Registra no balcão uma venda offline: debita o estoque e entra na fila. */
async function sellOffline(reference: string, quantity = 3): Promise<PendingSale> {
  const sale = pendingSale(reference, quantity);
  await consumeLocalStock([{ productId: 1, quantity }]);
  await savePendingSale(sale);
  return sale;
}

/** Estoque gravado do produto 1. */
async function storedStock(): Promise<number | undefined> {
  const db = await openLocalDatabase();
  return (await getByKey<LocalProduct>(db, STORE.products, 1))?.stock;
}

/** Todas as referências que subiram, em todas as chamadas. */
function sentReferences(): string[] {
  return apiPost.mock.calls.flatMap((call) =>
    (call[1] as SyncRequestBody).sales.map((s) => s.clientReference),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  resetLocalDatabase();
  serverAnswers("Created");

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
});

describe("idempotência entre rodadas", () => {
  it("não deve enviar a mesma venda duas vezes em rodadas seguidas", async () => {
    // A rodada seguinte acontece sozinha: `watchConnectivity` sonda a cada 15s e
    // dispara a drenagem em toda sondagem que dá online. Se a venda confirmada
    // continuasse na fila, o servidor a receberia de novo a cada 15 segundos —
    // e só o índice único do `clientReference` estaria segurando a duplicata.
    await sellOffline("checkout-1");

    const first = await syncPendingSales();
    const second = await syncPendingSales();

    expect(first).toMatchObject({ created: 1, remaining: 0 });
    expect(second).toMatchObject({ created: 0, remaining: 0 });
    expect(sentReferences()).toEqual(["checkout-1"]);
    expect(await listPendingSales()).toEqual([]);
  });

  it("deve tirar da fila a venda que o servidor já tinha gravado", async () => {
    // O lote subiu, o servidor gravou e a resposta se perdeu na volta. O
    // desfecho `Duplicated` é o servidor dizendo "essa eu já tenho": a venda sai
    // da fila e o estoque local NÃO é mexido — ele já foi debitado no balcão.
    await sellOffline("checkout-1");
    serverAnswers("Duplicated");

    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ duplicated: 1, remaining: 0 });
    expect(await listPendingSales()).toEqual([]);
    expect(await storedStock()).toBe(7);
  });

  it("deve enviar a chave do checkout, e não uma por tentativa", async () => {
    // A retentativa reusa a mesma chave; é ela que faz o backend devolver a
    // venda já gravada em vez de criar uma segunda quando o 504 do proxy chega
    // depois do commit.
    const sale = await sellOffline("checkout-1");
    apiPost.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await syncPendingSales();
    await syncPendingSales();

    expect(sentReferences()).toEqual(["checkout-1", "checkout-1"]);
    expect(sale.clientReference).toBe("checkout-1");
  });
});

describe("recusa do servidor", () => {
  it("deve devolver o estoque local e manter a venda na fila com o motivo", async () => {
    // A venda recusada não existe no servidor: o saldo local estava mentindo
    // para baixo e bloquearia venda de mercadoria que está na prateleira.
    await sellOffline("checkout-1");
    serverAnswers("Rejected", "Estoque insuficiente!");

    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ rejected: 1, remaining: 1 });
    expect(await storedStock()).toBe(10);
    expect((await listPendingSales())[0]).toMatchObject({
      status: "failed",
      lastError: "Estoque insuficiente!",
      stockApplied: false,
    });
  });

  it("não deve devolver o estoque duas vezes quando a recusa se repete", async () => {
    // O operador reenfileirou sem corrigir a causa. Sem o marcador
    // `stockApplied`, a segunda recusa devolveria o saldo de novo e o caixa
    // passaria a oferecer 13 unidades de um produto que tem 10.
    await sellOffline("checkout-1");
    serverAnswers("Rejected", "Estoque insuficiente!");
    await syncPendingSales();

    await retryPendingSale((await listPendingSales())[0]);
    await syncPendingSales();

    expect(await storedStock()).toBe(10);
  });

  it("deve redebitar o estoque quando a venda recusada finalmente entra", async () => {
    // A causa foi corrigida no admin e a venda subiu. O débito original foi
    // desfeito na recusa; sem refazê-lo, o saldo local ficaria inflado até o
    // próximo snapshot, liberando venda offline de produto que já saiu.
    await sellOffline("checkout-1");
    serverAnswers("Rejected", "Estoque insuficiente!");
    await syncPendingSales();

    await retryPendingSale((await listPendingSales())[0]);
    serverAnswers("Created");
    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ created: 1, remaining: 0 });
    expect(await storedStock()).toBe(7);
    expect(await listPendingSales()).toEqual([]);
  });

  it("não deve reenviar sozinha a venda recusada na rodada seguinte", async () => {
    // Repetir uma recusa determinística a cada sondagem só geraria ruído; ela
    // espera decisão do operador.
    await sellOffline("checkout-1");
    serverAnswers("Rejected", "Produto excluído!");
    await syncPendingSales();

    await syncPendingSales();

    expect(sentReferences()).toEqual(["checkout-1"]);
  });
});

describe("queda de conexão no meio da rodada", () => {
  it("deve manter a venda na fila, contar a tentativa e não mexer no estoque", async () => {
    // Entre perder a venda e guardá-la para sincronizar, guardar é sempre melhor.
    await sellOffline("checkout-1");
    apiPost.mockRejectedValue(new TypeError("Failed to fetch"));

    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ created: 0, rejected: 0, remaining: 1 });
    expect((await listPendingSales())[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      stockApplied: true,
    });
    expect(await storedStock()).toBe(7);
  });

  it("deve subir na rodada seguinte a venda que ficou para trás", async () => {
    await sellOffline("checkout-1");
    apiPost.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await syncPendingSales();
    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ created: 1, remaining: 0 });
    expect(await listPendingSales()).toEqual([]);
  });
});

describe("lotes", () => {
  it("deve dividir a fila em lotes do tamanho que o backend aceita", async () => {
    // O backend recusa lote acima de 50 vendas. Uma fila de um turno inteiro
    // offline passa disso com folga, e um lote grande demais seria recusado por
    // inteiro — as vendas ficariam presas sem que nenhuma delas tivesse problema.
    const total = SYNC_BATCH_SIZE + 1;
    for (let index = 0; index < total; index += 1) {
      await savePendingSale(pendingSale(`checkout-${index}`, 0, { offlineNumber: index }));
    }

    const outcome = await syncPendingSales();

    expect(apiPost).toHaveBeenCalledTimes(2);
    expect((apiPost.mock.calls[0][1] as SyncRequestBody).sales).toHaveLength(SYNC_BATCH_SIZE);
    expect((apiPost.mock.calls[1][1] as SyncRequestBody).sales).toHaveLength(1);
    expect(outcome).toMatchObject({ created: total, remaining: 0 });
  });
});
