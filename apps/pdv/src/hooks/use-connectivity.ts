import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { watchConnectivity } from "@/offline";
import { useOfflineStore } from "@/stores/use-offline-store";

/**
 * useConnectivity
 *
 * Liga o monitor de conexão ao estado do app. Deve ser usado **uma única vez**,
 * na raiz — duas instâncias sondariam a API em dobro.
 *
 * Responsabilidades:
 * - Manter `online` atualizado no store, sondando a API (não só `navigator.onLine`).
 * - Em toda sondagem que dá online — inclusive a primeira: sincronizar as filas
 *   locais (vendas e baixas de estoque) e só então recarregar as consultas em
 *   cache, para o histórico já refletir o que acabou de subir.
 *
 * A primeira sondagem conta de propósito: se o PDV abre já online com fila de
 * uma queda anterior (queda de energia com a internet de volta antes do reboot,
 * F5, crash do navegador), não haverá "reconexão" para disparar a subida — sem
 * este gatilho as vendas ficariam presas no navegador o turno inteiro. E o
 * `syncNow` já é no-op com a fila vazia, então a abertura normal não paga nada
 * além de uma contagem no IndexedDB.
 */
export function useConnectivity() {
  const queryClient = useQueryClient();
  const setOnline = useOfflineStore((state) => state.setOnline);
  const syncNow = useOfflineStore((state) => state.syncNow);
  const refreshCounts = useOfflineStore((state) => state.refreshCounts);

  useEffect(() => {
    void refreshCounts();

    const stop = watchConnectivity((online) => {
      setOnline(online);

      if (!online) return;

      void syncNow().then((outcome) => {
        if (!outcome) return;

        // Só invalida o cache quando algo mudou no servidor: invalidar a cada
        // reconexão recarregaria o histórico sem motivo. A baixa de estoque
        // entra na conta porque ela também mexe no saldo dos produtos.
        const changedOnServer = outcome.sales.created + outcome.writeOffs.sent;
        if (changedOnServer > 0) {
          void queryClient.invalidateQueries();
        }
      });
    });

    return stop;
  }, [queryClient, refreshCounts, setOnline, syncNow]);
}
