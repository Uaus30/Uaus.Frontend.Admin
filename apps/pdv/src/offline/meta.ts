import { META_KEY, STORE, openLocalDatabase, type MetaRecord } from "./database";
import { getByKey, put } from "./idb";

/**
 * Metadados da base local: quando o snapshot foi baixado, em que formato, e o
 * sequencial dos cupons provisórios das vendas offline.
 */

/** Lê um metadado, ou `null` quando ele nunca foi gravado. */
export async function readMeta<T>(key: string): Promise<T | null> {
  const db = await openLocalDatabase();
  const record = await getByKey<MetaRecord>(db, STORE.meta, key);
  return record ? (record.value as T) : null;
}

/** Grava um metadado. */
export async function writeMeta(key: string, value: unknown): Promise<void> {
  const db = await openLocalDatabase();
  await put<MetaRecord>(db, STORE.meta, { key, value });
}

/** Estado da base local, para exibir ao operador e decidir se dá para vender offline. */
export interface LocalDatabaseState {
  /** Quando o PDV baixou o snapshot, em ISO. Nulo se nunca baixou. */
  downloadedAt: string | null;
  /** Quando o backend gerou o snapshot, em ISO. */
  generatedAt: string | null;
  /** Versão do formato do snapshot que gerou esta base. */
  schemaVersion: number | null;
}

/** Lê o estado da base local numa só passada. */
export async function readLocalDatabaseState(): Promise<LocalDatabaseState> {
  const [downloadedAt, generatedAt, schemaVersion] = await Promise.all([
    readMeta<string>(META_KEY.snapshotDownloadedAt),
    readMeta<string>(META_KEY.snapshotGeneratedAt),
    readMeta<number>(META_KEY.snapshotSchemaVersion),
  ]);

  return { downloadedAt, generatedAt, schemaVersion };
}

/**
 * Guarda a sessão de caixa aberta que o servidor confirmou.
 *
 * O PDV precisa dela para sobreviver a um recarregamento sem internet: depois de
 * uma queda de energia a máquina reinicia, o caixa continua aberto no servidor e
 * `GET /CashRegisterSessions/current` não tem como responder. Sem esta cópia, o
 * operador cairia na tela de abertura de caixa — que também exige internet.
 *
 * @param session Sessão como o servidor devolveu, ou `null` para descartar a cópia
 *   (fechamento do caixa ou logout).
 */
export async function writeCachedCashRegisterSession(session: unknown | null): Promise<void> {
  await writeMeta(META_KEY.cashRegisterSession, session);
}

/**
 * Lê a última sessão de caixa confirmada pelo servidor.
 *
 * @returns A sessão guardada, ou `null` quando não há nenhuma.
 */
export function readCachedCashRegisterSession<T>(): Promise<T | null> {
  return readMeta<T>(META_KEY.cashRegisterSession);
}

/**
 * Reserva o próximo número provisório de cupom offline.
 *
 * O número é só do caixa e não tem relação com o ID da venda no banco — ele
 * existe para o cupom impresso ter uma identificação, e sai marcado como
 * provisório justamente para ninguém confundir com o número definitivo.
 *
 * @returns O número reservado, começando em 1.
 */
export async function nextOfflineSaleNumber(): Promise<number> {
  const current = (await readMeta<number>(META_KEY.offlineSaleSequence)) ?? 0;
  const next = current + 1;
  await writeMeta(META_KEY.offlineSaleSequence, next);
  return next;
}
