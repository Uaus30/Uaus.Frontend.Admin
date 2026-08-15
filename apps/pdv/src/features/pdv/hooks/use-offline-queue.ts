import { useCallback, useState } from "react";
import { useToast } from "@workspace/ui";
import { useOfflinePdv } from "@/hooks/use-offline-pdv";
import {
  listPendingSales,
  listPendingWriteOffs,
  removePendingSale,
  removePendingWriteOff,
  retryPendingSale,
  retryPendingWriteOff,
  type PendingSale,
  type PendingWriteOff,
} from "@/offline";

export interface UseOfflineQueueParams {
  /** Sessão de caixa aberta, ou `null` com o caixa fechado. */
  sessionId: number | null;
  /** Chamado depois de uma sincronização que gravou vendas no servidor. */
  onSynced?: () => void | Promise<void>;
}

/**
 * As duas filas locais — vendas e baixas — e o que o operador pode fazer com
 * elas.
 *
 * Elas andam juntas de propósito: para quem está no balcão são a mesma
 * preocupação ("o que ainda não chegou no servidor"), e é a soma das duas que
 * trava o fechamento do caixa.
 *
 * **Descartar um movimento recusado não devolve estoque local.** A recusa já
 * devolveu o saldo quando o movimento saiu do ar; devolver de novo inflaria o
 * estoque local e o PDV passaria a vender o que não existe.
 */
export function useOfflineQueue({ sessionId, onSynced }: UseOfflineQueueParams) {
  const { toast } = useToast();
  const offline = useOfflinePdv(sessionId);
  const { sync, updateLocalDatabase, refreshCounts, snapshotError, online } = offline;

  const [queue, setQueue] = useState<PendingSale[]>([]);
  const [writeOffQueue, setWriteOffQueue] = useState<PendingWriteOff[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  /** `clientReference` do movimento com a confirmação de descarte aberta. */
  const [confirmingDiscard, setConfirmingDiscard] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const [sales, writeOffs] = await Promise.all([listPendingSales(), listPendingWriteOffs()]);
      setQueue(sales);
      setWriteOffQueue(writeOffs);
    } catch {
      setQueue([]);
      setWriteOffQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  /** Sincroniza as duas filas e avisa o resultado. */
  const syncNow = useCallback(async () => {
    const outcome = await sync();

    if (!outcome) {
      toast({
        title: online ? "Nada a sincronizar" : "Sem conexão",
        description: online
          ? "Não há vendas nem baixas na fila aguardando envio."
          : "A sincronização acontece automaticamente quando a conexão voltar.",
      });
      return;
    }

    await loadQueue();
    // Só venda gravada muda o histórico e o resumo do caixa; a baixa não entra
    // em nenhum dos dois.
    if (outcome.sales.created > 0) await onSynced?.();

    const rejected = outcome.sales.rejected + outcome.writeOffs.rejected;

    toast({
      title: rejected > 0 ? "Sincronização com pendências" : "Fila sincronizada",
      description: [
        outcome.sales.created > 0 && `${outcome.sales.created} venda(s) enviada(s)`,
        outcome.sales.duplicated > 0 && `${outcome.sales.duplicated} já constava(m) no servidor`,
        outcome.writeOffs.sent > 0 && `${outcome.writeOffs.sent} baixa(s) enviada(s)`,
        rejected > 0 && `${rejected} recusada(s) — confira na fila`,
      ]
        .filter(Boolean)
        .join(", "),
      variant: rejected > 0 ? "destructive" : undefined,
      duration: 6000,
      className: rejected > 0 ? undefined : "bg-emerald-500 text-white border-none",
    });
  }, [loadQueue, onSynced, online, sync, toast]);

  /** Rebaixa o snapshot a pedido do operador. */
  const updateDatabase = useCallback(async () => {
    const result = await updateLocalDatabase();

    if (!result) {
      toast({
        title: "Não foi possível atualizar a base local",
        description: snapshotError ?? "Verifique a conexão e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Base local atualizada",
      description: `${result.products} produtos, ${result.paymentMethods} formas de pagamento e ${result.customers} clientes.`,
      className: "bg-emerald-500 text-white border-none",
    });
  }, [snapshotError, toast, updateLocalDatabase]);

  /** Devolve uma venda recusada para a fila de reenvio. */
  const retrySale = useCallback(
    async (sale: PendingSale) => {
      await retryPendingSale(sale);
      await refreshCounts();
      await loadQueue();
      toast({
        title: "Venda reenfileirada",
        description: `A venda OFF-${sale.offlineNumber} será enviada na próxima sincronização.`,
      });
    },
    [loadQueue, refreshCounts, toast],
  );

  /** Descarta uma venda recusada. Ver a nota sobre estoque no topo do arquivo. */
  const discardSale = useCallback(
    async (sale: PendingSale) => {
      await removePendingSale(sale.clientReference);
      await refreshCounts();
      await loadQueue();
      setConfirmingDiscard(null);
      toast({
        title: "Venda descartada",
        description: `A venda OFF-${sale.offlineNumber} foi removida da fila e não será gravada.`,
        variant: "destructive",
      });
    },
    [loadQueue, refreshCounts, toast],
  );

  /** Devolve uma baixa recusada para a fila de reenvio. */
  const retryWriteOff = useCallback(
    async (writeOff: PendingWriteOff) => {
      await retryPendingWriteOff(writeOff);
      await refreshCounts();
      await loadQueue();
      toast({
        title: "Baixa reenfileirada",
        description: "Ela será enviada na próxima sincronização.",
      });
    },
    [loadQueue, refreshCounts, toast],
  );

  /** Descarta uma baixa recusada. Ver a nota sobre estoque no topo do arquivo. */
  const discardWriteOff = useCallback(
    async (writeOff: PendingWriteOff) => {
      await removePendingWriteOff(writeOff.clientReference);
      await refreshCounts();
      await loadQueue();
      setConfirmingDiscard(null);
      toast({
        title: "Baixa descartada",
        description: "Ela foi removida da fila e não será gravada.",
        variant: "destructive",
      });
    },
    [loadQueue, refreshCounts, toast],
  );

  return {
    offline,
    queue,
    writeOffQueue,
    loadingQueue,
    confirmingDiscard,
    setConfirmingDiscard,
    loadQueue,
    syncNow,
    updateDatabase,
    retrySale,
    discardSale,
    retryWriteOff,
    discardWriteOff,
  };
}
