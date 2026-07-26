import { openDatabase, type StoreSchema } from "./idb";

/**
 * Schema da base local do PDV.
 *
 * Quatro stores de cadastro, que são cópia descartável do servidor, e uma store
 * de fila, que contém venda que só existe aqui.
 */

/** Nome do banco no navegador do caixa. */
const DATABASE_NAME = "uaus-pdv-offline";

/**
 * Versão do schema local. **Suba ao mudar qualquer store abaixo** — as stores de
 * cadastro são recriadas vazias e o próximo snapshot as repovoa.
 *
 * Não confunda com o `schemaVersion` do snapshot, que é o contrato do backend:
 * este é a estrutura do IndexedDB. Um pode mudar sem o outro.
 */
const DATABASE_VERSION = 1;

/** Nomes das stores, num só lugar para não haver string solta pelo código. */
export const STORE = {
  /** Metadados da base local: versão do snapshot, quando foi baixado, sequencial offline. */
  meta: "meta",
  products: "products",
  paymentMethods: "paymentMethods",
  customers: "customers",
  /** Vendas registradas offline, à espera de sincronização. */
  pendingSales: "pendingSales",
} as const;

const STORES: StoreSchema[] = [
  { name: STORE.meta, keyPath: "key" },
  { name: STORE.products, keyPath: "id" },
  { name: STORE.paymentMethods, keyPath: "id" },
  { name: STORE.customers, keyPath: "id" },
  { name: STORE.pendingSales, keyPath: "clientReference" },
];

/**
 * Stores que a migração não pode apagar: as que guardam estado que **só** existe
 * aqui.
 *
 * A fila é o caso óbvio — perdê-la significa perder venda que o servidor nunca
 * viu. Os metadados entram pelo mesmo motivo: o sequencial dos cupons
 * provisórios (que voltaria a repetir números) e a sessão de caixa guardada (sem
 * a qual um recarregamento offline travaria o PDV) não têm de onde ser
 * recuperados. As marcas do snapshot que também moram ali são regravadas na
 * próxima carga.
 */
const PRESERVED_STORES: string[] = [STORE.meta, STORE.pendingSales];

/** Stores de cadastro, substituídas por inteiro a cada snapshot. */
export const CATALOG_STORES: string[] = [STORE.products, STORE.paymentMethods, STORE.customers];

/** Chaves da store de metadados. */
export const META_KEY = {
  /** Versão do formato do snapshot que gerou a base local. */
  snapshotSchemaVersion: "snapshotSchemaVersion",
  /** Quando o snapshot foi baixado, em ISO. */
  snapshotDownloadedAt: "snapshotDownloadedAt",
  /** Quando o backend gerou o snapshot, em ISO. */
  snapshotGeneratedAt: "snapshotGeneratedAt",
  /** Último número provisório usado em cupom de venda offline. */
  offlineSaleSequence: "offlineSaleSequence",
  /**
   * Última sessão de caixa aberta que o servidor confirmou.
   *
   * Guardada para o PDV sobreviver a um recarregamento sem internet — o caso da
   * queda de energia, em que a máquina reinicia com o caixa aberto no servidor e
   * o PDV não tem como perguntar qual é.
   */
  cashRegisterSession: "cashRegisterSession",
} as const;

/** Um registro da store de metadados. */
export interface MetaRecord {
  key: string;
  value: unknown;
}

/**
 * Conexão única com o banco, memoizada.
 *
 * Abrir uma conexão por operação seria lento e, pior, disparia `onblocked` em
 * cascata durante a migração.
 */
let connection: Promise<IDBDatabase> | null = null;

/**
 * Abre a base local, reaproveitando a conexão já aberta.
 *
 * @throws Quando o navegador não suporta IndexedDB ou a base está bloqueada por
 *   outra aba do PDV.
 */
export function openLocalDatabase(): Promise<IDBDatabase> {
  if (connection) return connection;

  connection = openDatabase(DATABASE_NAME, DATABASE_VERSION, STORES, PRESERVED_STORES).catch(
    (error: unknown) => {
      // Uma falha não pode ficar memoizada, senão a próxima tentativa (depois de
      // fechar a outra aba, por exemplo) receberia o mesmo erro para sempre.
      connection = null;
      throw error;
    },
  );

  return connection;
}

/**
 * Descarta a conexão memoizada. Usado nos testes e ao encerrar a sessão do caixa.
 */
export function closeLocalDatabase() {
  void connection?.then((db) => db.close()).catch(() => undefined);
  connection = null;
}
