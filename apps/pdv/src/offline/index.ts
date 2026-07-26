/**
 * Camada offline do PDV — base local no navegador e fila de vendas pendentes.
 *
 * Nenhum arquivo daqui conhece React: são apenas dados e regras, para que a tela
 * possa ser testada sem IndexedDB e a persistência possa ser testada sem React.
 *
 * A orquestração (quando baixar o snapshot, quando sincronizar) vive em
 * `hooks/use-offline-pdv.ts`; o estado observável, em `stores/use-offline-store.ts`.
 *
 * Documentação: `apps/pdv/docs/offline.md` (navegador) e
 * `Uaus.Backend.Api/docs/pdv-offline.md` (contrato da API).
 *
 * Mapa dos arquivos:
 *
 * - `idb.ts` — wrapper de IndexedDB em Promises, sem nada específico do PDV.
 * - `database.ts` — schema da base local: stores, versão, chaves de metadados.
 * - `meta.ts` — quando o snapshot foi baixado e o sequencial de cupom provisório.
 * - `snapshot.ts` — baixa o cadastro da API e substitui a base local.
 * - `catalog.ts` — busca de produtos e clientes na base local.
 * - `stock.ts` — projeção local do estoque: conferência, baixa e devolução.
 * - `pending-sales.ts` — a fila de vendas offline.
 * - `sync.ts` — envio da fila em lotes e aplicação dos desfechos.
 * - `connectivity.ts` — se a API está respondendo (não só se há rede).
 */

export { closeLocalDatabase, openLocalDatabase } from "./database";
export {
  nextOfflineSaleNumber,
  readCachedCashRegisterSession,
  readLocalDatabaseState,
  writeCachedCashRegisterSession,
  type LocalDatabaseState,
} from "./meta";

export {
  downloadSnapshot,
  installSnapshot,
  normalizeForSearch,
  refreshLocalDatabase,
  type SnapshotInstallResult,
} from "./snapshot";

export {
  filterCustomers,
  filterProducts,
  getLocalProduct,
  listLocalPaymentMethods,
  listLocalProducts,
  searchLocalCustomers,
  searchLocalProducts,
} from "./catalog";

export {
  checkLocalStock,
  consumeLocalStock,
  findStockShortages,
  restoreLocalStock,
  type StockMovement,
  type StockShortage,
} from "./stock";

export {
  countPendingSales,
  listPendingSales,
  listSalesToSync,
  markPendingSaleAttempted,
  markPendingSaleFailed,
  removePendingSale,
  retryPendingSale,
  savePendingSale,
  tallyPendingSales,
  type PendingSalesTally,
} from "./pending-sales";

export {
  applySyncResults,
  buildSaleRequestBody,
  chunk,
  readSyncStatus,
  syncPendingSales,
  SYNC_BATCH_SIZE,
  type PdvSaleRequestBody,
} from "./sync";

export { probeApi, watchConnectivity, type ConnectivityListener } from "./connectivity";

export type {
  LocalCustomer,
  LocalPaymentMethod,
  LocalPaymentMethodInstallment,
  LocalProduct,
  PdvSnapshot,
  PendingSale,
  PendingSaleItem,
  PendingSalePayment,
  PendingSaleStatus,
  SaleSyncResult,
  SyncOutcome,
  SyncSalesResponse,
} from "./types";
