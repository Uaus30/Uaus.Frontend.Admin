import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDatabase } from "@/test/local-database";
import {
  countPendingSales,
  listPendingSales,
  listSalesToSync,
  markPendingSaleAttempted,
  markPendingSaleFailed,
  removePendingSale,
  retryPendingSale,
  savePendingSale,
  tallyPendingSales,
} from "./pending-sales";
import type { PendingSale } from "./types";

/**
 * A fila de vendas offline, contra um IndexedDB de verdade.
 *
 * A fila é a única store da base local que contém dado que o servidor não tem —
 * perder uma linha aqui é perder venda. O que estes testes exercitam é a
 * **chave primária** (`clientReference`), que é o mecanismo de idempotência: ela
 * é a chave do CHECKOUT, gerada no primeiro clique em "Confirmar" e reutilizada
 * em toda retentativa daquela venda. Nada disso é visível dublando o `idb.ts`:
 * quem recusa a segunda linha é o banco.
 */

/** Venda da fila, com o essencial preenchido. */
function pendingSale(reference: string, overrides: Partial<PendingSale> = {}): PendingSale {
  return {
    clientReference: reference,
    offlineNumber: 1,
    occurredAt: "2026-08-15T17:34:12",
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 50,
    discount: 0,
    notes: null,
    items: [{ productId: 1, quantity: 2, unitPrice: 25, productName: "Café" }],
    payments: [
      {
        paymentMethodId: 1,
        paymentMethodInstallmentId: null,
        amount: 50,
        installments: 1,
        transactionFee: 0,
        paymentMethodName: "Dinheiro",
      },
    ],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/** Uma venda da fila pela referência, ou `undefined` se ela não está mais lá. */
async function findQueued(reference: string): Promise<PendingSale | undefined> {
  return (await listPendingSales()).find((sale) => sale.clientReference === reference);
}

beforeEach(() => {
  resetLocalDatabase();
});

describe("idempotência da fila", () => {
  it("deve manter uma linha só quando a mesma venda é gravada duas vezes", async () => {
    // O caso real: o POST saiu, o proxy devolveu 504 depois do commit e o
    // operador clicou em "Confirmar" de novo. A chave é a do checkout, então a
    // segunda gravação SUBSTITUI a primeira. Sem isso, a fila subiria duas
    // vendas e o cliente apareceria cobrado em dobro na conferência.
    await savePendingSale(pendingSale("checkout-1"));
    await savePendingSale(pendingSale("checkout-1", { attempts: 1 }));

    expect(await countPendingSales()).toBe(1);
    expect((await findQueued("checkout-1"))?.attempts).toBe(1);
  });

  it("deve guardar vendas diferentes em linhas diferentes", async () => {
    // A contraprova: a fila não está deduplicando tudo, e sim casando pela chave.
    await savePendingSale(pendingSale("checkout-1"));
    await savePendingSale(pendingSale("checkout-2", { offlineNumber: 2 }));

    expect(await countPendingSales()).toBe(2);
  });

  it("não deve criar linha nova ao registrar uma tentativa da mesma venda", async () => {
    // A chave é do CHECKOUT, não da tentativa. Se cada retentativa gravasse com
    // referência nova, uma queda de rede no meio da sincronização multiplicaria
    // a venda na fila — e o servidor, que dedupe por `clientReference`, gravaria
    // uma venda por referência distinta.
    const sale = pendingSale("checkout-1");
    await savePendingSale(sale);

    await markPendingSaleAttempted(sale);
    await markPendingSaleAttempted({ ...sale, attempts: 1 });

    const queued = await findQueued("checkout-1");
    expect(await countPendingSales()).toBe(1);
    expect(queued).toMatchObject({ status: "pending", attempts: 2 });
  });
});

describe("ordem da fila", () => {
  it("deve devolver as vendas da mais antiga para a mais nova", async () => {
    // As vendas disputam o mesmo estoque no servidor: a primeira do balcão
    // precisa ser a primeira a consumir, senão a recusa por falta de saldo cai
    // na venda errada.
    await savePendingSale(pendingSale("checkout-2", { occurredAt: "2026-08-15T18:00:00" }));
    await savePendingSale(pendingSale("checkout-1", { occurredAt: "2026-08-15T17:00:00" }));

    expect((await listPendingSales()).map((sale) => sale.clientReference)).toEqual([
      "checkout-1",
      "checkout-2",
    ]);
  });

  it("deve desempatar pelo número provisório do cupom", async () => {
    // Duas vendas no mesmo segundo acontecem: o sequencial impresso é o que diz
    // qual saiu primeiro.
    const occurredAt = "2026-08-15T17:34:12";
    await savePendingSale(pendingSale("checkout-b", { occurredAt, offlineNumber: 8 }));
    await savePendingSale(pendingSale("checkout-a", { occurredAt, offlineNumber: 7 }));

    expect((await listPendingSales()).map((sale) => sale.offlineNumber)).toEqual([7, 8]);
  });
});

describe("recusa e reenvio", () => {
  it("deve gravar o motivo da recusa e desmarcar o débito de estoque", async () => {
    const sale = pendingSale("checkout-1");
    await savePendingSale(sale);

    await markPendingSaleFailed(sale, "Estoque insuficiente!");

    // `stockApplied: false` é o registro de que o saldo local já foi devolvido —
    // é ele que evita a devolução em dobro numa segunda recusa e que manda
    // debitar de novo se a venda acabar entrando.
    expect(await findQueued("checkout-1")).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "Estoque insuficiente!",
      stockApplied: false,
    });
  });

  it("não deve reenviar automaticamente a venda recusada", async () => {
    // Repetir uma recusa determinística (produto excluído, estoque insuficiente)
    // só geraria ruído a cada rodada. Ela espera decisão do operador.
    await savePendingSale(pendingSale("checkout-1"));
    await markPendingSaleFailed(pendingSale("checkout-1"), "Produto excluído!");
    await savePendingSale(pendingSale("checkout-2", { offlineNumber: 2 }));

    expect((await listSalesToSync()).map((sale) => sale.clientReference)).toEqual(["checkout-2"]);
  });

  it("deve devolver a venda recusada para o reenvio sem apagar o marcador de estoque", async () => {
    // O operador corrigiu a causa e reenfileirou. `status` volta para `pending`,
    // mas `stockApplied` continua `false`: o débito foi desfeito na recusa e
    // precisa ser refeito quando a venda entrar. Zerar o marcador aqui deixaria
    // o estoque local inflado até o próximo snapshot, liberando venda offline de
    // produto que já saiu da prateleira.
    const sale = pendingSale("checkout-1");
    await savePendingSale(sale);
    await markPendingSaleFailed(sale, "Estoque insuficiente!");

    await retryPendingSale((await findQueued("checkout-1")) as PendingSale);

    expect(await findQueued("checkout-1")).toMatchObject({
      status: "pending",
      lastError: null,
      stockApplied: false,
      attempts: 1,
    });
  });

  it("deve tirar da fila a venda que o servidor confirmou", async () => {
    await savePendingSale(pendingSale("checkout-1"));

    await removePendingSale("checkout-1");

    expect(await countPendingSales()).toBe(0);
  });

  it("deve ignorar a remoção de uma venda que já saiu da fila", async () => {
    // Duas rodadas de sincronização quase simultâneas podem confirmar a mesma
    // venda; a segunda remoção não pode explodir no meio da drenagem.
    await expect(removePendingSale("checkout-inexistente")).resolves.toBeUndefined();
  });
});

describe("tallyPendingSales", () => {
  it("deve separar o que será reenviado do que espera decisão", async () => {
    // É o número que o fechamento de caixa consulta: enquanto houver qualquer
    // dos dois, a gaveta não fecha.
    await savePendingSale(pendingSale("checkout-1"));
    await savePendingSale(pendingSale("checkout-2", { offlineNumber: 2 }));
    await markPendingSaleFailed(pendingSale("checkout-2", { offlineNumber: 2 }), "Recusada!");

    expect(await tallyPendingSales()).toEqual({ pending: 1, failed: 1 });
  });

  it("deve contar zero com a fila vazia", async () => {
    expect(await tallyPendingSales()).toEqual({ pending: 0, failed: 0 });
    expect(await countPendingSales()).toBe(0);
  });
});
