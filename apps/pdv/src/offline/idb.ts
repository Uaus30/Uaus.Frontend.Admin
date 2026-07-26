/**
 * Wrapper mínimo de IndexedDB em Promises.
 *
 * Existe para não trazer uma biblioteca por causa de meia dúzia de operações: o
 * PDV lê e grava por chave, varre stores inteiras e faz baixa de estoque numa
 * transação. Nada aqui é específico do PDV — o schema do banco do caixa mora em
 * `database.ts`.
 *
 * Toda API do IndexedDB é baseada em eventos; estas funções são a única ponte
 * para Promises no app, e o resto do módulo `offline/` só fala Promise.
 */

/** Descrição de uma store a ser criada na migração do banco. */
export interface StoreSchema {
  name: string;
  /** Propriedade usada como chave primária. */
  keyPath: string;
}

/**
 * Abre (e migra) o banco.
 *
 * A migração é destrutiva de propósito: ao subir a versão, as stores declaradas
 * são recriadas vazias. A base local é uma cópia descartável do servidor —
 * exceto a fila de vendas pendentes, que é preservada explicitamente porque
 * perdê-la significaria perder venda de verdade.
 *
 * @param name Nome do banco.
 * @param version Versão do schema. Subir força a migração.
 * @param stores Stores que o banco precisa ter.
 * @param preserveStores Stores que a migração não pode apagar.
 */
export function openDatabase(
  name: string,
  version: number,
  stores: StoreSchema[],
  preserveStores: string[] = [],
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não suporta IndexedDB; o modo offline não está disponível."));
      return;
    }

    const request = indexedDB.open(name, version);

    request.onupgradeneeded = () => {
      const db = request.result;

      for (const store of stores) {
        if (db.objectStoreNames.contains(store.name)) {
          // A fila de vendas sobrevive à migração: ela contém venda que o
          // servidor ainda não conhece, e não há de onde recuperá-la.
          if (preserveStores.includes(store.name)) continue;
          db.deleteObjectStore(store.name);
        }

        db.createObjectStore(store.name, { keyPath: store.keyPath });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir a base local."));
    request.onblocked = () =>
      reject(new Error("A base local está aberta em outra aba. Feche as demais abas do PDV."));
  });
}

/** Converte um IDBRequest em Promise. */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha na operação da base local."));
  });
}

/**
 * Espera o fim de uma transação.
 *
 * As requisições individuais podem já ter tido sucesso e a transação ainda
 * falhar na hora de confirmar (cota do navegador, por exemplo). Só o `complete`
 * garante que os dados estão gravados.
 */
function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("A gravação na base local foi desfeita."));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Falha ao gravar na base local."));
  });
}

/** Lê um registro pela chave, ou `null` quando ele não existe. */
export async function getByKey<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | null> {
  const transaction = db.transaction(store, "readonly");
  const result = await promisify<T | undefined>(transaction.objectStore(store).get(key));
  return result ?? null;
}

/** Lê todos os registros de uma store. */
export async function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  const transaction = db.transaction(store, "readonly");
  return promisify<T[]>(transaction.objectStore(store).getAll());
}

/** Conta os registros de uma store sem carregá-los. */
export async function count(db: IDBDatabase, store: string): Promise<number> {
  const transaction = db.transaction(store, "readonly");
  return promisify<number>(transaction.objectStore(store).count());
}

/** Grava (ou substitui) um registro. */
export async function put<T>(db: IDBDatabase, store: string, value: T): Promise<void> {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).put(value);
  await waitForTransaction(transaction);
}

/**
 * Grava muitos registros numa transação só.
 *
 * Uma transação por registro tornaria a carga do snapshot lenta o suficiente
 * para o operador notar — são milhares de produtos.
 */
export async function putAll<T>(db: IDBDatabase, store: string, values: T[]): Promise<void> {
  if (values.length === 0) return;

  const transaction = db.transaction(store, "readwrite");
  const objectStore = transaction.objectStore(store);
  for (const value of values) objectStore.put(value);
  await waitForTransaction(transaction);
}

/** Apaga um registro pela chave. */
export async function remove(db: IDBDatabase, store: string, key: IDBValidKey): Promise<void> {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).delete(key);
  await waitForTransaction(transaction);
}

/** Esvazia uma store. */
export async function clear(db: IDBDatabase, store: string): Promise<void> {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).clear();
  await waitForTransaction(transaction);
}

/** Esvazia várias stores na mesma transação. */
export async function clearAll(db: IDBDatabase, stores: string[]): Promise<void> {
  if (stores.length === 0) return;

  const transaction = db.transaction(stores, "readwrite");
  for (const store of stores) transaction.objectStore(store).clear();
  await waitForTransaction(transaction);
}

/**
 * Roda uma leitura-alteração-gravação sobre vários registros de uma store
 * dentro de uma única transação.
 *
 * É o que a baixa de estoque precisa: ler o produto, subtrair e gravar sem que
 * duas vendas simultâneas leiam o mesmo saldo e gravem uma por cima da outra.
 *
 * @param keys Chaves a serem alteradas.
 * @param mutate Recebe o registro atual (ou `null`) e devolve o novo, ou `null`
 *   para deixá-lo como está.
 */
export async function updateMany<T>(
  db: IDBDatabase,
  store: string,
  keys: IDBValidKey[],
  mutate: (current: T | null, key: IDBValidKey) => T | null,
): Promise<void> {
  if (keys.length === 0) return;

  const transaction = db.transaction(store, "readwrite");
  const objectStore = transaction.objectStore(store);

  for (const key of keys) {
    const current = await promisify<T | undefined>(objectStore.get(key));
    const next = mutate(current ?? null, key);
    if (next !== null) objectStore.put(next);
  }

  await waitForTransaction(transaction);
}
