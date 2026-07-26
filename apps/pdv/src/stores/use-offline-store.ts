import { create } from "zustand";
import {
  readLocalDatabaseState,
  refreshLocalDatabase,
  syncPendingSales,
  tallyPendingSales,
  type LocalDatabaseState,
  type SnapshotInstallResult,
  type SyncOutcome,
} from "@/offline";

/**
 * Estado observável do modo offline: se a API responde, como está a base local e
 * quantas vendas esperam sincronização.
 *
 * As ações assíncronas moram aqui, e não nos componentes, por dois motivos: elas
 * precisam ser reentrantes (duas sincronizações simultâneas enviariam o mesmo
 * lote duas vezes) e são chamadas de lugares diferentes — o relógio da conexão,
 * o botão "sincronizar agora" e a abertura da sessão de caixa.
 *
 * Os dados em si vivem em `@/offline`; aqui só o estado da interface.
 */
interface OfflineState {
  /** A API está respondendo. Começa otimista e é corrigido pela primeira sondagem. */
  online: boolean;
  /** A primeira sondagem já terminou. Antes disso a tela não deve acusar queda. */
  connectionChecked: boolean;

  /** Uma sincronização está em andamento. */
  syncing: boolean;
  /** O snapshot está sendo baixado. */
  refreshingSnapshot: boolean;

  /** Vendas que serão reenviadas na próxima sincronização. */
  pending: number;
  /** Vendas recusadas pelo servidor, à espera de decisão do operador. */
  failed: number;

  /** Estado da base local: quando foi baixada e em que formato. */
  snapshot: LocalDatabaseState | null;
  /** Motivo da última falha ao baixar o snapshot, ou `null`. */
  snapshotError: string | null;

  /** Resumo da última sincronização concluída. */
  lastSync: (SyncOutcome & { at: string }) | null;

  /**
   * Sessão de caixa cuja base local já foi baixada.
   *
   * Fica no store, e não num ref do hook, porque mais de um componente usa
   * `useOfflinePdv` — com o guard por instância, dois deles baixariam o snapshot
   * na mesma abertura de caixa.
   */
  snapshotSessionId: number | null;

  /** Registra o resultado da sondagem de conexão. */
  setOnline: (online: boolean) => void;
  /** Recarrega a contagem da fila a partir da base local. */
  refreshCounts: () => Promise<void>;
  /** Recarrega o estado da base local (quando o snapshot foi baixado). */
  refreshSnapshotState: () => Promise<void>;
  /**
   * Baixa e instala o snapshot, substituindo o cadastro local.
   *
   * @param sessionId Sessão de caixa que motivou a atualização, registrada para
   *   não baixar o snapshot duas vezes no mesmo turno.
   * @returns O que foi instalado, ou `null` quando falhou (o motivo fica em
   *   `snapshotError`). Não lança: falhar em atualizar a base local não pode
   *   impedir o caixa de abrir e vender online.
   */
  refreshSnapshot: (sessionId?: number | null) => Promise<SnapshotInstallResult | null>;
  /**
   * Envia a fila de vendas offline.
   *
   * @returns O resumo da rodada, ou `null` quando não havia o que fazer (sem
   *   conexão, fila vazia, ou outra sincronização já em andamento).
   */
  syncNow: () => Promise<SyncOutcome | null>;
  /** Zera o estado ao encerrar a sessão do caixa. */
  reset: () => void;
}

/** Mensagem legível de um erro qualquer. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Falha inesperada.";
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  online: true,
  connectionChecked: false,
  syncing: false,
  refreshingSnapshot: false,
  pending: 0,
  failed: 0,
  snapshot: null,
  snapshotError: null,
  lastSync: null,
  snapshotSessionId: null,

  setOnline: (online) => set(() => ({ online, connectionChecked: true })),

  refreshCounts: async () => {
    try {
      const tally = await tallyPendingSales();
      set(() => ({ pending: tally.pending, failed: tally.failed }));
    } catch {
      // Base local indisponível (navegador sem IndexedDB, aba duplicada). O
      // indicador fica como está em vez de derrubar a tela.
    }
  },

  refreshSnapshotState: async () => {
    try {
      const snapshot = await readLocalDatabaseState();
      set(() => ({ snapshot }));
    } catch {
      // Idem: o estado da base é informativo, não pode travar o PDV.
    }
  },

  refreshSnapshot: async (sessionId = null) => {
    if (get().refreshingSnapshot) return null;

    set(() => ({ refreshingSnapshot: true, snapshotError: null }));
    try {
      const result = await refreshLocalDatabase();
      // O estado exibido vem da base local, não do que acabou de ser baixado:
      // é ela que carrega a marca de atualização gravada pela instalação.
      await get().refreshSnapshotState();
      set(() => ({ snapshotSessionId: sessionId }));
      return result;
    } catch (error) {
      set(() => ({ snapshotError: describeError(error) }));
      return null;
    } finally {
      set(() => ({ refreshingSnapshot: false }));
    }
  },

  syncNow: async () => {
    const state = get();
    if (state.syncing || !state.online) return null;

    await state.refreshCounts();
    if (get().pending === 0) return null;

    set(() => ({ syncing: true }));
    try {
      const outcome = await syncPendingSales();
      set(() => ({ lastSync: { ...outcome, at: new Date().toISOString() } }));
      await get().refreshCounts();
      return outcome;
    } finally {
      set(() => ({ syncing: false }));
    }
  },

  reset: () =>
    set(() => ({
      syncing: false,
      refreshingSnapshot: false,
      pending: 0,
      failed: 0,
      snapshotError: null,
      lastSync: null,
      snapshotSessionId: null,
    })),
}));
