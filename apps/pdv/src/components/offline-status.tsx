import { useCallback, useState } from "react";
import { STOCK_WRITE_OFF_REASON_LABEL } from "@workspace/api-client-react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Cloud,
  Database,
  Loader2,
  PackageMinus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { useToast } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { useCompanySettings } from "@/hooks/use-company-settings";
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

type OfflineStatusProps = {
  /** Sessão de caixa aberta, ou `null` com o caixa fechado. */
  sessionId: number | null;
  /** Chamado depois de uma sincronização que gravou vendas no servidor. */
  onSynced?: () => void | Promise<void>;
};

/** Formata uma data ISO como hora local curta. */
function formatTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Indicador do estado offline no cabeçalho do PDV, e o painel das filas locais.
 *
 * O operador precisa de três respostas à mão: o servidor está respondendo? tem
 * movimento esperando para subir? de quando é a base local que estou usando? O
 * chip responde as duas primeiras de relance; o painel detalha as três e oferece
 * as ações — sincronizar agora, atualizar a base, e o que fazer com uma venda ou
 * baixa que o servidor recusou.
 *
 * As duas filas aparecem juntas de propósito: para quem está no balcão elas são
 * a mesma preocupação — "o que ainda não chegou no servidor" — e é esse número
 * que trava o fechamento do caixa.
 */
export function OfflineStatus({ sessionId, onSynced }: OfflineStatusProps) {
  const { toast } = useToast();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [queue, setQueue] = useState<PendingSale[]>([]);
  const [writeOffQueue, setWriteOffQueue] = useState<PendingWriteOff[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState<string | null>(null);

  const { mode } = useCompanySettings();

  const {
    online,
    connectionChecked,
    pendingCount,
    failedCount,
    queuedSalesCount,
    pendingWriteOffCount,
    failedWriteOffCount,
    queuedWriteOffCount,
    queuedCount,
    syncing,
    refreshingSnapshot,
    snapshot,
    snapshotError,
    hasLocalDatabase,
    sync,
    updateLocalDatabase,
    refreshCounts,
  } = useOfflinePdv(sessionId);

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

  // A fila só é carregada com o painel aberto: são dados que ninguém olha o tempo
  // todo, e a contagem do chip já vem do store. A carga sai do clique que abre o
  // painel, não de um efeito — abrir é um evento do usuário, e disparar a busca
  // ali evita o render extra que o efeito causava.
  const openPanel = () => {
    setIsPanelOpen(true);
    void loadQueue();
  };

  /** Sincroniza as duas filas e avisa o resultado. */
  const handleSync = async () => {
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
  };

  /** Rebaixa o snapshot a pedido do operador. */
  const handleUpdateDatabase = async () => {
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
  };

  /** Devolve uma venda recusada para a fila de reenvio. */
  const handleRetry = async (sale: PendingSale) => {
    await retryPendingSale(sale);
    await refreshCounts();
    await loadQueue();
    toast({
      title: "Venda reenfileirada",
      description: `A venda OFF-${sale.offlineNumber} será enviada na próxima sincronização.`,
    });
  };

  /**
   * Descarta uma venda recusada.
   *
   * O estoque local **não** é devolvido aqui: a recusa já devolveu o saldo quando
   * a venda saiu do ar. Devolver de novo inflaria o estoque local.
   */
  const handleDiscard = async (sale: PendingSale) => {
    await removePendingSale(sale.clientReference);
    await refreshCounts();
    await loadQueue();
    setConfirmingDiscard(null);
    toast({
      title: "Venda descartada",
      description: `A venda OFF-${sale.offlineNumber} foi removida da fila e não será gravada.`,
      variant: "destructive",
    });
  };

  /** Devolve uma baixa recusada para a fila de reenvio. */
  const handleRetryWriteOff = async (writeOff: PendingWriteOff) => {
    await retryPendingWriteOff(writeOff);
    await refreshCounts();
    await loadQueue();
    toast({
      title: "Baixa reenfileirada",
      description: "Ela será enviada na próxima sincronização.",
    });
  };

  /**
   * Descarta uma baixa recusada.
   *
   * O estoque local **não** é devolvido aqui: a recusa já devolveu o saldo. Pelo
   * mesmo motivo da venda, devolver de novo inflaria o estoque local.
   */
  const handleDiscardWriteOff = async (writeOff: PendingWriteOff) => {
    await removePendingWriteOff(writeOff.clientReference);
    await refreshCounts();
    await loadQueue();
    setConfirmingDiscard(null);
    toast({
      title: "Baixa descartada",
      description: "Ela foi removida da fila e não será gravada.",
      variant: "destructive",
    });
  };

  const showChip = !online || queuedCount > 0;

  return (
    <>
      {showChip && (
        <button
          type="button"
          onClick={openPanel}
          title="Estado da conexão e fila de vendas offline"
          className={`relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
            online
              ? "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400"
              : "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : online ? (
            <Cloud className="h-4 w-4" />
          ) : (
            <CloudOff className="h-4 w-4" />
          )}
          {online ? "Fila offline" : "Offline"}
          {queuedCount > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 font-mono text-[10px] font-bold text-white">
              {queuedCount}
            </span>
          )}
        </button>
      )}

      <Dialog open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-[720px]">
          <div className="shrink-0 border-b border-border/50 bg-primary/10 p-6">
            <DialogTitle className="flex items-center gap-2 font-display text-2xl font-bold">
              <Database className="h-6 w-6 text-primary" /> Operação offline
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Estado da conexão, da base local e das vendas aguardando sincronização.
            </DialogDescription>
          </div>

          {/* `min-h-0` é o que permite a área rolar: sem ele um filho `flex-1` não
              encolhe abaixo do próprio conteúdo, e uma mensagem de erro longa
              empurrava o diálogo para fora da tela. */}
          <ScrollArea className="min-h-0 flex-1 p-6">
            <div className="space-y-4">
              {/* Conexão */}
              <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex items-center gap-3">
                  {online ? (
                    <Cloud className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <CloudOff className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-bold leading-tight">
                      {!connectionChecked
                        ? "Verificando conexão..."
                        : online
                          ? "Servidor respondendo"
                          : "Sem conexão com o servidor"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {online
                        ? "As vendas são gravadas direto no servidor."
                        : "As vendas ficam na fila local e sobem quando a conexão voltar."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Base local */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Database
                    className={`h-5 w-5 shrink-0 ${hasLocalDatabase ? "text-primary" : "text-destructive"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight">Base local</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {hasLocalDatabase && snapshot?.downloadedAt
                        ? `Atualizada em ${formatTime(snapshot.downloadedAt)}`
                        : "Nunca baixada — sem ela o PDV não vende offline."}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 cursor-pointer"
                  onClick={handleUpdateDatabase}
                  disabled={refreshingSnapshot || !online}
                >
                  {refreshingSnapshot ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Atualizar
                </Button>
              </div>

              {snapshotError && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{snapshotError}</span>
                </div>
              )}

              {/* Fila */}
              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold leading-tight">
                      Fila de vendas offline
                      {queuedSalesCount > 0 && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {pendingCount} a enviar
                          {failedCount > 0 && ` · ${failedCount} recusada(s)`}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {queuedCount === 0
                        ? "Nenhum movimento pendente."
                        : mode.usesCashRegister
                          ? "O caixa não pode ser fechado com movimento pendente."
                          : "Movimento aguardando o servidor."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-2 cursor-pointer"
                    onClick={handleSync}
                    disabled={syncing || !online || pendingCount + pendingWriteOffCount === 0}
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sincronizar
                  </Button>
                </div>

                {loadingQueue ? (
                  <div className="py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : queue.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs italic text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Nenhuma venda pendente.
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {queue.map((sale) => (
                      <div
                        key={sale.clientReference}
                        className={`rounded-lg border p-3 ${
                          sale.status === "failed"
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-border/40 bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold">OFF-{sale.offlineNumber}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {formatTime(sale.occurredAt)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  sale.status === "failed"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {sale.status === "failed" ? "Recusada" : "A enviar"}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {sale.items.length} item(ns) ·{" "}
                              {sale.items.map((item) => item.productName).join(", ")}
                            </p>
                            {sale.lastError && (
                              // Altura limitada e rolagem própria: a mensagem vem do
                              // servidor e não tem tamanho previsível.
                              <p className="mt-1 max-h-20 overflow-y-auto break-words text-[11px] font-medium text-destructive">
                                {sale.lastError}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-mono text-sm font-bold text-primary">
                              {formatCurrency(sale.total)}
                            </span>

                            {sale.status === "failed" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-primary"
                                  title="Tentar enviar novamente"
                                  onClick={() => handleRetry(sale)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                                  title="Descartar a venda"
                                  onClick={() =>
                                    setConfirmingDiscard(
                                      confirmingDiscard === sale.clientReference
                                        ? null
                                        : sale.clientReference,
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {confirmingDiscard === sale.clientReference && (
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2">
                            <span className="text-[11px] font-medium text-destructive">
                              Descartar esta venda? Ela não será gravada no servidor.
                            </span>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer text-xs"
                                onClick={() => setConfirmingDiscard(null)}
                              >
                                Manter
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 cursor-pointer text-xs"
                                onClick={() => handleDiscard(sale)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fila de baixas de estoque */}
              <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                <div className="flex items-center gap-3">
                  <PackageMinus
                    className={`h-5 w-5 shrink-0 ${queuedWriteOffCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                  />
                  <div>
                    <p className="text-sm font-bold leading-tight">
                      Fila de baixas de estoque
                      {queuedWriteOffCount > 0 && (
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {pendingWriteOffCount} a enviar
                          {failedWriteOffCount > 0 && ` · ${failedWriteOffCount} recusada(s)`}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Consumo, perda e doação registrados sem conexão. O estoque local já está
                      descontado.
                    </p>
                  </div>
                </div>

                {loadingQueue ? (
                  <div className="py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : writeOffQueue.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs italic text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Nenhuma baixa pendente.
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {writeOffQueue.map((writeOff) => (
                      <div
                        key={writeOff.clientReference}
                        className={`rounded-lg border p-3 ${
                          writeOff.status === "failed"
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-border/40 bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                {STOCK_WRITE_OFF_REASON_LABEL[writeOff.reason] ?? "Baixa"}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {formatTime(writeOff.occurredAt)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  writeOff.status === "failed"
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {writeOff.status === "failed" ? "Recusada" : "A enviar"}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {writeOff.items
                                .map((item) => `${item.quantity}x ${item.productName}`)
                                .join(", ")}
                            </p>
                            {writeOff.lastError && (
                              <p className="mt-1 max-h-20 overflow-y-auto break-words text-[11px] font-medium text-destructive">
                                {writeOff.lastError}
                              </p>
                            )}
                          </div>

                          {writeOff.status === "failed" && (
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-primary"
                                title="Tentar enviar novamente"
                                onClick={() => handleRetryWriteOff(writeOff)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                                title="Descartar a baixa"
                                onClick={() =>
                                  setConfirmingDiscard(
                                    confirmingDiscard === writeOff.clientReference
                                      ? null
                                      : writeOff.clientReference,
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {confirmingDiscard === writeOff.clientReference && (
                          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2">
                            <span className="text-[11px] font-medium text-destructive">
                              Descartar esta baixa? Ela não será gravada no servidor.
                            </span>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 cursor-pointer text-xs"
                                onClick={() => setConfirmingDiscard(null)}
                              >
                                Manter
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 cursor-pointer text-xs"
                                onClick={() => handleDiscardWriteOff(writeOff)}
                              >
                                Descartar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-border/50 bg-muted/10 p-4 text-right">
            <Button onClick={() => setIsPanelOpen(false)} className="cursor-pointer">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


