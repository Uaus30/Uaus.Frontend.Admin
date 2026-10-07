import type { CashRegisterSessionDto } from "@workspace/api-client-react";
import { staleLocalDataSince } from "@/lib/stale-local-data";
import { useOfflineStore } from "@/stores/use-offline-store";

export interface UseStaleLocalDataParams {
  online: boolean;
  /** Sessão de caixa em uso. */
  session: CashRegisterSessionDto | null;
  /** A sessão em uso veio da cópia local. */
  isSessionFromCache: boolean;
}

/**
 * O dia do caixa ou da base local deste aparelho, quando ele está sem internet
 * e esse dia não é hoje — ver `staleLocalDataSince`. Alimenta o aviso vermelho
 * do topo (`StaleLocalDataBanner`).
 */
export function useStaleLocalData({ online, session, isSessionFromCache }: UseStaleLocalDataParams) {
  const snapshotDownloadedAt = useOfflineStore((state) => state.snapshot?.downloadedAt ?? null);

  return staleLocalDataSince({
    online,
    isSessionFromCache,
    sessionOpenedAt: session?.openedAt ?? null,
    snapshotDownloadedAt,
    now: new Date(),
  });
}
