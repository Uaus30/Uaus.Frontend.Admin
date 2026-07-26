import { useCallback, useEffect } from "react";
import { useOfflineStore } from "@/stores/use-offline-store";
import type { QueueSyncOutcome } from "@/offline";

/**
 * useOfflinePdv
 *
 * O que a tela do PDV precisa saber sobre o modo offline, e as duas ações que ela
 * pode disparar: atualizar a base local e sincronizar a fila.
 *
 * Pode ser usado por mais de um componente sem duplicar trabalho — o controle de
 * "snapshot já baixado neste turno" vive no store, não aqui.
 *
 * Responsabilidades:
 * - Baixar o snapshot **uma vez por sessão de caixa**, como o fluxo pede: a base
 *   local é atualizada na abertura do caixa e vale para o turno inteiro.
 * - Expor o estado consolidado para o indicador de conexão e o painel da fila.
 *
 * @param sessionId Sessão de caixa aberta, ou `null` com o caixa fechado.
 */
export function useOfflinePdv(sessionId: number | null) {
  const online = useOfflineStore((state) => state.online);
  const connectionChecked = useOfflineStore((state) => state.connectionChecked);
  const syncing = useOfflineStore((state) => state.syncing);
  const refreshingSnapshot = useOfflineStore((state) => state.refreshingSnapshot);
  const pending = useOfflineStore((state) => state.pending);
  const failed = useOfflineStore((state) => state.failed);
  const pendingWriteOffs = useOfflineStore((state) => state.pendingWriteOffs);
  const failedWriteOffs = useOfflineStore((state) => state.failedWriteOffs);
  const snapshot = useOfflineStore((state) => state.snapshot);
  const snapshotError = useOfflineStore((state) => state.snapshotError);
  const lastSync = useOfflineStore((state) => state.lastSync);
  const snapshotSessionId = useOfflineStore((state) => state.snapshotSessionId);

  const refreshSnapshot = useOfflineStore((state) => state.refreshSnapshot);
  const refreshSnapshotState = useOfflineStore((state) => state.refreshSnapshotState);
  const refreshCounts = useOfflineStore((state) => state.refreshCounts);
  const syncNow = useOfflineStore((state) => state.syncNow);

  useEffect(() => {
    void refreshSnapshotState();
  }, [refreshSnapshotState]);

  useEffect(() => {
    if (sessionId === null) return;
    if (snapshotSessionId === sessionId) return;

    // Sem conexão não há snapshot a baixar; a base local do turno anterior é o
    // que o caixa tem, e continua servindo. A data em que ela foi baixada fica
    // visível no painel para o operador julgar.
    if (!online) return;

    void refreshSnapshot(sessionId);
  }, [sessionId, snapshotSessionId, online, refreshSnapshot]);

  /**
   * Sincroniza as filas agora, a pedido do operador.
   *
   * @returns O resumo da rodada, ou `null` quando não havia o que sincronizar.
   */
  const sync = useCallback((): Promise<QueueSyncOutcome | null> => syncNow(), [syncNow]);

  /** Rebaixa o snapshot a pedido do operador (botão "atualizar base local"). */
  const updateLocalDatabase = useCallback(
    () => refreshSnapshot(sessionId),
    [refreshSnapshot, sessionId],
  );

  return {
    /** A API está respondendo. */
    online,
    /** Falso enquanto a primeira sondagem não terminou. */
    connectionChecked,
    /** Vendas na fila que serão reenviadas. */
    pendingCount: pending,
    /** Vendas recusadas pelo servidor, à espera de decisão. */
    failedCount: failed,
    /** Total de vendas guardadas localmente. */
    queuedSalesCount: pending + failed,
    /** Baixas de estoque na fila que serão reenviadas. */
    pendingWriteOffCount: pendingWriteOffs,
    /** Baixas recusadas pelo servidor, à espera de decisão. */
    failedWriteOffCount: failedWriteOffs,
    /** Total de baixas guardadas localmente. */
    queuedWriteOffCount: pendingWriteOffs + failedWriteOffs,
    /**
     * Tudo que o servidor ainda não conhece: vendas **e** baixas.
     *
     * É o número que o fechamento de caixa consulta. Deixar a baixa de fora
     * fecharia o turno com movimento de estoque preso no navegador, que subiria
     * depois carimbado numa sessão já encerrada.
     */
    queuedCount: pending + failed + pendingWriteOffs + failedWriteOffs,
    syncing,
    refreshingSnapshot,
    /** Estado da base local: quando foi baixada, em que formato. */
    snapshot,
    /** Motivo da última falha ao baixar o snapshot. */
    snapshotError,
    /** Resumo da última sincronização. */
    lastSync,
    /** A base local nunca foi baixada — o PDV não tem como vender offline. */
    hasLocalDatabase: snapshot?.downloadedAt != null,
    sync,
    updateLocalDatabase,
    refreshCounts,
  };
}
