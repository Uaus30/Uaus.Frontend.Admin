import { META_KEY, STORE, openLocalDatabase, type MetaRecord } from "./database";
import { getByKey, put, updateMany } from "./idb";
import type { LocalCompanySettings } from "./types";

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
 * Guarda as configurações da empresa como o servidor as devolveu.
 *
 * Elas decidem se o PDV exige abertura de caixa, e essa pergunta precisa de
 * resposta na primeira tela — antes de qualquer requisição ter dado certo. Sem a
 * cópia, um PDV aberto sem internet cairia no padrão em vez da configuração real
 * da loja, e o operador veria um diálogo de abertura de caixa que a loja não usa
 * (ou deixaria de vê-lo numa loja que usa).
 *
 * A identidade da loja (nome, endereço, CNPJ, rodapé) viaja na mesma cópia: é
 * ela que mantém o cabeçalho do cupom correto num PDV vendendo offline.
 *
 * @param settings Configurações recebidas da API.
 */
export async function writeCachedCompanySettings(settings: LocalCompanySettings): Promise<void> {
  await writeMeta(META_KEY.companySettings, settings);
}

/**
 * Lê as configurações da empresa guardadas na base local.
 *
 * @returns As configurações guardadas, ou `null` quando o PDV nunca conseguiu
 *   lê-las do servidor. Quem chama decide o padrão — ele é uma regra de produto,
 *   não de persistência.
 */
export function readCachedCompanySettings(): Promise<LocalCompanySettings | null> {
  return readMeta<LocalCompanySettings>(META_KEY.companySettings);
}

/**
 * Reserva o próximo número provisório de cupom offline.
 *
 * O número é só do caixa e não tem relação com o ID da venda no banco — ele
 * existe para o cupom impresso ter uma identificação, e sai marcado como
 * provisório justamente para ninguém confundir com o número definitivo.
 *
 * A leitura e a gravação acontecem numa **única transação readwrite**
 * (`updateMany`): ler numa transação e gravar em outra abria uma janela em que
 * duas reservas concorrentes liam o mesmo valor e imprimiam o mesmo `OFF-n` em
 * cupons diferentes.
 *
 * @returns O número reservado, começando em 1.
 */
export async function nextOfflineSaleNumber(): Promise<number> {
  const db = await openLocalDatabase();

  let next = 0;
  await updateMany<MetaRecord>(db, STORE.meta, [META_KEY.offlineSaleSequence], (current) => {
    const value = typeof current?.value === "number" ? current.value : 0;
    next = value + 1;
    return { key: META_KEY.offlineSaleSequence, value: next };
  });

  return next;
}
