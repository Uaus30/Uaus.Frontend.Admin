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
 * - `coupons.ts` — cupons do snapshot e a consulta do cupom pelo código, sem rede.
 * - `stock.ts` — projeção local do estoque: conferência, baixa e devolução.
 * - `pending-sales.ts` — a fila de vendas offline.
 * - `sync.ts` — envio da fila de vendas em lotes e aplicação dos desfechos.
 * - `pending-write-offs.ts` — a fila de baixas de estoque offline.
 * - `write-off-sync.ts` — envio das baixas, uma a uma.
 * - `queues.ts` — as duas filas vistas como uma coisa só.
 * - `connectivity.ts` — se a API está respondendo (não só se há rede).
 */

export { closeLocalDatabase, openLocalDatabase } from "./database";
export {
  nextOfflineSaleNumber,
  readCachedCashRegisterSession,
  readCachedCompanySettings,
  readLocalDatabaseState,
  writeCachedCashRegisterSession,
  writeCachedCompanySettings,
  type LocalDatabaseState,
} from "./meta";

export {
  clearLocalCatalog,
  collectPendingStockDebits,
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
  invalidateProductsCache,
} from "./catalog";

export {
  countQueuedRedemptions,
  lookupLocalCoupon,
  readLocalCoupons,
  resolveLocalCoupon,
  toLocalCoupon,
  writeLocalCoupons,
  type LocalCouponFound,
  type LocalCouponLookup,
  type LocalCouponLookupInput,
  type LocalCouponRefusal,
  type LocalCouponRefused,
} from "./coupons";

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

export {
  listPendingWriteOffs,
  listWriteOffsToSync,
  markPendingWriteOffAttempted,
  markPendingWriteOffFailed,
  removePendingWriteOff,
  retryPendingWriteOff,
  savePendingWriteOff,
  tallyPendingWriteOffs,
  type PendingWriteOffsTally,
} from "./pending-write-offs";

export { buildWriteOffRequestBody, classifyWriteOffFailure, syncPendingWriteOffs } from "./write-off-sync";

export { syncPendingQueues, tallyPendingQueues, type QueuesTally } from "./queues";

export { probeApi, watchConnectivity, type ConnectivityListener } from "./connectivity";

export type {
  LocalCompanySettings,
  LocalCoupon,
  LocalCouponQuestion,
  LocalCouponQuestionOption,
  LocalCustomer,
  LocalPaymentMethod,
  LocalPaymentMethodInstallment,
  LocalProduct,
  PdvSnapshot,
  PdvSnapshotCoupon,
  PendingSale,
  PendingSaleCoupon,
  PendingSaleCouponAnswer,
  PendingSaleItem,
  PendingSalePayment,
  PendingSaleStatus,
  PendingWriteOff,
  PendingWriteOffItem,
  PendingWriteOffStatus,
  QueueSyncOutcome,
  SaleSyncResult,
  SyncOutcome,
  SyncSalesResponse,
  WriteOffSyncOutcome,
} from "./types";
