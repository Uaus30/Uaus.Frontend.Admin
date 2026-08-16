import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDatabase } from "@/test/local-database";
import { CATALOG_STORES, STORE, closeLocalDatabase, openLocalDatabase } from "./database";
import { getAll, put } from "./idb";
import { readMeta } from "./meta";
import { listPendingSales } from "./pending-sales";
import { listPendingWriteOffs } from "./pending-write-offs";
import type { PendingSale, PendingWriteOff, LocalProduct } from "./types";

/**
 * A migração da base local, contra um IndexedDB de verdade.
 *
 * É o teste mais caro de não existir no PDV inteiro. `apps/pdv/docs/offline.md`
 * avisa que subir `DATABASE_VERSION` **apaga as stores de cadastro de todo caixa
 * da rede** na primeira abertura depois do deploy, e que `PRESERVED_STORES`
 * existe para as duas filas e os metadados sobreviverem a isso. Se alguém tirar
 * um nome daquela lista, nada quebra na compilação e nenhum teste de unidade
 * reclama: o caixa simplesmente abre depois do deploy com a fila vazia, e a
 * venda que já saiu do balcão só é dada por perdida na conferência do dia.
 *
 * Por isso o exercício aqui é o banco de verdade — a migração é comportamento do
 * IndexedDB, não do nosso código, e um dublê de `idb.ts` não a executa.
 */

/**
 * Nome do banco no navegador. Repetido aqui porque `database.ts` não o exporta.
 *
 * A duplicação não engana: se o nome mudar lá, o banco semeado por estes testes
 * vira outro banco, a migração roda sobre uma base vazia e as asserções falham
 * em vez de passar por engano.
 */
const DATABASE_NAME = "uaus-pdv-offline";

/** Descrição de store no formato que o `openDatabase` de produção usa. */
interface SeedStore {
  name: string;
  keyPath: string;
}

/** Stores como a versão 1 do PDV as tinha: antes da fila de baixas de estoque. */
const V1_STORES: SeedStore[] = [
  { name: STORE.meta, keyPath: "key" },
  { name: STORE.products, keyPath: "id" },
  { name: STORE.paymentMethods, keyPath: "id" },
  { name: STORE.customers, keyPath: "id" },
  { name: STORE.pendingSales, keyPath: "clientReference" },
];

/** As mesmas de cima, mais a fila de baixas — o caixa como ele está hoje. */
const V1_STORES_WITH_WRITE_OFFS: SeedStore[] = [
  ...V1_STORES,
  { name: STORE.pendingWriteOffs, keyPath: "clientReference" },
];

/**
 * Abre um banco fora do código de produção, para semear a base "de antes do
 * deploy". É o único jeito de ter uma base numa versão anterior à que
 * `openLocalDatabase` pede — e é a versão anterior que faz a migração rodar.
 */
function openSeedDatabase(version: number, stores: SeedStore[]): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, version);

    request.onupgradeneeded = () => {
      for (const store of stores) request.result.createObjectStore(store.name, { keyPath: store.keyPath });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao semear a base."));
  });
}

/** Venda na fila, no formato que o caixa grava. */
function pendingSale(reference: string, overrides: Partial<PendingSale> = {}): PendingSale {
  return {
    clientReference: reference,
    offlineNumber: 14,
    occurredAt: "2026-08-15T17:34:12",
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 50,
    discount: 0,
    notes: null,
    items: [{ productId: 1, quantity: 2, unitPrice: 25, productName: "Café" }],
    payments: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/** Baixa de estoque na fila. */
function pendingWriteOff(reference: string): PendingWriteOff {
  return {
    clientReference: reference,
    occurredAt: "2026-08-15T17:40:00",
    reason: 2,
    notes: null,
    items: [{ productId: 1, quantity: 1, productName: "Café" }],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
  };
}

/** Produto do catálogo local. */
function localProduct(id: number, stock: number): LocalProduct {
  return {
    id,
    name: "Café",
    barcode: "789",
    price: 25,
    stock,
    status: 2,
    productGroupId: 1,
    searchName: "cafe",
  };
}

beforeEach(() => {
  resetLocalDatabase();
});

describe("migração da base local", () => {
  it("deve preservar a venda pendente quando a versão do banco sobe", async () => {
    // O cenário que dá nome ao problema: o caixa fez vendas offline, o deploy
    // subiu `DATABASE_VERSION`, e na primeira abertura a migração roda. Sem
    // `PRESERVED_STORES`, a fila desaparece aqui — em silêncio, porque nada
    // falha: o PDV abre normal, sem as vendas, e a falta só aparece na
    // conferência do caixa, quando o cliente já foi embora.
    const legacy = await openSeedDatabase(1, V1_STORES);
    await put(legacy, STORE.pendingSales, pendingSale("checkout-1"));
    legacy.close();

    await openLocalDatabase();

    const queue = await listPendingSales();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ clientReference: "checkout-1", total: 50, offlineNumber: 14 });
  });

  it("deve preservar a fila de baixas de estoque na próxima subida de versão", async () => {
    // A fila de baixas entrou na v2 e ainda não passou por migração nenhuma.
    // Para provar que ela sobrevive à PRÓXIMA, a base é semeada numa versão
    // antiga já contendo a store: o `onupgradeneeded` de produção só olha se a
    // store existe, não em que versão ela nasceu. O que está sob teste é a lista
    // `PRESERVED_STORES` de verdade, com a versão de produção.
    const legacy = await openSeedDatabase(1, V1_STORES_WITH_WRITE_OFFS);
    await put(legacy, STORE.pendingWriteOffs, pendingWriteOff("baixa-1"));
    await put(legacy, STORE.products, localProduct(1, 5));
    legacy.close();

    const db = await openLocalDatabase();

    expect((await listPendingWriteOffs()).map((item) => item.clientReference)).toEqual(["baixa-1"]);
    // O produto some junto: é ele que prova que a migração destrutiva rodou de
    // verdade sobre esta base, e não que a asserção acima passou porque o teste
    // abriu um banco novo e vazio por engano.
    expect(await getAll(db, STORE.products)).toEqual([]);
  });

  it("deve preservar os metadados que não têm de onde ser recuperados", async () => {
    // Sequencial do cupom provisório, sessão de caixa aberta e configurações da
    // empresa: sem internet não há de onde buscá-los de novo. Perder o
    // sequencial faria o caixa reimprimir "OFF-1" num turno que já teve um.
    const legacy = await openSeedDatabase(1, V1_STORES);
    await put(legacy, STORE.meta, { key: "offlineSaleSequence", value: 14 });
    await put(legacy, STORE.meta, { key: "cashRegisterSession", value: { id: 7 } });
    await put(legacy, STORE.meta, { key: "companySettings", value: { usesCashRegister: true } });
    legacy.close();

    await openLocalDatabase();

    expect(await readMeta<number>("offlineSaleSequence")).toBe(14);
    expect(await readMeta<{ id: number }>("cashRegisterSession")).toEqual({ id: 7 });
    expect(await readMeta<{ usesCashRegister: boolean }>("companySettings")).toEqual({
      usesCashRegister: true,
    });
  });

  it("deve recriar as stores de cadastro vazias", async () => {
    // A outra metade do contrato, e ela também precisa valer: o cadastro é cópia
    // descartável do servidor. Preservá-lo por engano manteria no caixa um
    // produto que o admin excluiu, com o preço de antes.
    const legacy = await openSeedDatabase(1, V1_STORES);
    await put(legacy, STORE.products, localProduct(1, 5));
    await put(legacy, STORE.paymentMethods, { id: 1, name: "Dinheiro", installments: [] });
    await put(legacy, STORE.customers, {
      id: 1,
      name: "Ana",
      document: null,
      phone: null,
      searchName: "ana",
    });
    // A venda entra junto para o teste não poder passar por engano: se o banco
    // semeado fosse outro, a migração abriria uma base vazia e as três stores
    // apareceriam vazias sem nada ter sido apagado. A venda sobrevivente é a
    // prova de que a base exercitada é esta.
    await put(legacy, STORE.pendingSales, pendingSale("checkout-1"));
    legacy.close();

    const db = await openLocalDatabase();

    for (const store of CATALOG_STORES) {
      expect(await getAll(db, store)).toEqual([]);
    }
    expect(await listPendingSales()).toHaveLength(1);
  });

  it("deve criar a store que ainda não existia na base antiga", async () => {
    // A migração v1 → v2 de verdade: a fila de baixas não existia, e sem ela
    // criada a primeira baixa offline depois do deploy morreria com
    // NotFoundError no meio do balcão.
    const legacy = await openSeedDatabase(1, V1_STORES);
    legacy.close();

    const db = await openLocalDatabase();

    expect([...db.objectStoreNames]).toContain(STORE.pendingWriteOffs);
  });

  it("não deve apagar cadastro ao reabrir a base na mesma versão", async () => {
    // O apagão é do salto de versão, não da abertura. Se fosse da abertura, todo
    // F5 do caixa deixaria o PDV sem preço e sem estoque enquanto estivesse
    // offline — exatamente a situação para a qual a base local existe.
    const db = await openLocalDatabase();
    await put(db, STORE.products, localProduct(1, 5));
    closeLocalDatabase();

    const reopened = await openLocalDatabase();

    expect(await getAll<LocalProduct>(reopened, STORE.products)).toHaveLength(1);
  });
});

describe("openLocalDatabase", () => {
  it("deve reaproveitar a conexão em vez de abrir uma por operação", async () => {
    // Uma conexão por operação seria lenta e, pior, dispararia `onblocked` em
    // cascata durante a migração — o caixa travaria na abertura do turno.
    const [first, second] = await Promise.all([openLocalDatabase(), openLocalDatabase()]);

    expect(first).toBe(second);
  });

  it("deve avisar sobre a outra aba e permitir tentar de novo depois de fechá-la", async () => {
    // Duas abas do PDV na mesma máquina compartilham a base, e a migração fica
    // bloqueada enquanto a aba antiga segurar a versão anterior. A falha NÃO
    // pode ficar memoizada: se ficasse, fechar a outra aba não resolveria nada e
    // o operador teria que reiniciar o navegador no meio do turno.
    const otherTab = await openSeedDatabase(1, V1_STORES);

    await expect(openLocalDatabase()).rejects.toThrow(/outra aba/i);

    otherTab.close();

    await expect(openLocalDatabase()).resolves.toBeDefined();
  });
});
