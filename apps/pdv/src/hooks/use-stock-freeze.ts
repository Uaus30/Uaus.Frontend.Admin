import { useEffect, useRef } from "react";
import { useGetStockFreezeStatus } from "@workspace/api-client-react";
import { useOfflineStore } from "@/stores/use-offline-store";

/**
 * O balcão está impedido de vender? Com a conferência de estoque aberta, sim
 * (decisão do dono, 23/09/2026): a contagem compara a prateleira com o saldo, e
 * venda no meio dela produz a diferença errada.
 *
 * O servidor recusa a venda de qualquer jeito; esta consulta é o que deixa o PDV
 * avisar ANTES — a faixa no topo e o FINALIZAR travado —, em vez de o operador
 * descobrir no fim da venda, com o cliente esperando. Reconsulta a cada 30
 * segundos (`STOCK_FREEZE_POLL_MS`).
 *
 * **Sem conexão, vale o último estado conhecido.** Quem viu a conferência abrir
 * e caiu da rede continua impedido: é o comportamento conservador que o dono
 * pediu. Quem não viu — ela abriu com o PDV sem rede, ou a página foi recarregada
 * sem rede — vende offline, e a sincronização é recusada em lote (423) enquanto a
 * conferência estiver aberta: as vendas ficam pendentes. É raro: o dono avaliou
 * que o PDV quase nunca fica offline.
 *
 * **Encerrada a conferência, a fila sobe na hora.** As vendas e baixas que o
 * servidor recusou com 423 esperavam exatamente isso; sem o gatilho, ficariam
 * até a próxima reconexão ou o fechamento do caixa.
 */
export function useStockFreeze(): { salesPaused: boolean; pausedSince?: string } {
  const online = useOfflineStore((state) => state.online);
  const syncNow = useOfflineStore((state) => state.syncNow);
  const { data } = useGetStockFreezeStatus({ query: { enabled: online, retry: false } });
  const salesPaused = data?.salesPaused === true;

  const wasPaused = useRef(salesPaused);
  useEffect(() => {
    if (wasPaused.current && !salesPaused) void syncNow();
    wasPaused.current = salesPaused;
  }, [salesPaused, syncNow]);

  return { salesPaused, pausedSince: data?.pausedSince };
}
