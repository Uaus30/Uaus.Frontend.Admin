import { useEffect, useRef } from "react";
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
 * - Ao voltar a conexão: sincronizar as filas locais (vendas e baixas de
 *   estoque) e só então recarregar as consultas em cache, para o histórico já
 *   refletir o que acabou de subir.
 */
export function useConnectivity() {
  const queryClient = useQueryClient();
  const setOnline = useOfflineStore((state) => state.setOnline);
  const syncNow = useOfflineStore((state) => state.syncNow);
  const refreshCounts = useOfflineStore((state) => state.refreshCounts);

  // A primeira notificação do monitor é o estado inicial, não uma reconexão:
  // sincronizar ali seria disparar uma rodada a cada abertura do PDV.
  const hadFirstResult = useRef(false);

  useEffect(() => {
    void refreshCounts();

    const stop = watchConnectivity((online) => {
      setOnline(online);

      const isReconnection = hadFirstResult.current && online;
      hadFirstResult.current = true;

      if (!isReconnection) return;

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
