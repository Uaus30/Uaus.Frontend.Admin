import { useState } from "react";
import { CheckCircle2, Cloud, CloudOff, Database, Loader2, PackageMinus, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useOfflineQueue } from "@/features/pdv/hooks/use-offline-queue";
import { PendingSaleRow, PendingWriteOffRow } from "@/features/pdv/components/offline-queue-rows";
import { ConnectionCard, LocalDatabaseCard } from "@/features/pdv/components/offline-status-cards";

type OfflineStatusProps = {
  /** Sessão de caixa aberta, ou `null` com o caixa fechado. */
  sessionId: number | null;
  /** Chamado depois de uma sincronização que gravou vendas no servidor. */
  onSynced?: () => void | Promise<void>;
};

/**
 * Indicador do estado offline no cabeçalho do PDV, e o painel das filas locais.
 *
 * O operador precisa de três respostas à mão: o servidor está respondendo? tem
 * movimento esperando para subir? de quando é a base local que estou usando? O
 * chip responde as duas primeiras de relance; o painel detalha as três e oferece
 * as ações — sincronizar agora, atualizar a base, e o que fazer com uma venda ou
 * baixa que o servidor recusou.
 *
 * As ações e as duas filas vivem em `features/pdv/hooks/use-offline-queue.ts`.
 */
export function OfflineStatus({ sessionId, onSynced }: OfflineStatusProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const { mode } = useCompanySettings();

  const {
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
  } = useOfflineQueue({ sessionId, onSynced });

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
  } = offline;

  // A fila só é carregada com o painel aberto: são dados que ninguém olha o tempo
  // todo, e a contagem do chip já vem do store. A carga sai do clique que abre o
  // painel, não de um efeito — abrir é um evento do usuário, e disparar a busca
  // ali evita o render extra que o efeito causava.
  const openPanel = () => {
    setIsPanelOpen(true);
    void loadQueue();
  };

  /** Alterna a confirmação de descarte de um movimento da fila. */
  const toggleConfirm = (clientReference: string) =>
    setConfirmingDiscard(confirmingDiscard === clientReference ? null : clientReference);

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
              <ConnectionCard online={online} connectionChecked={connectionChecked} />

              <LocalDatabaseCard
                hasLocalDatabase={hasLocalDatabase}
                snapshot={snapshot}
                refreshingSnapshot={refreshingSnapshot}
                online={online}
                snapshotError={snapshotError}
                onUpdate={() => void updateDatabase()}
              />

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
                    onClick={() => void syncNow()}
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
                      <PendingSaleRow
                        key={sale.clientReference}
                        sale={sale}
                        confirming={confirmingDiscard === sale.clientReference}
                        onToggleConfirm={() => toggleConfirm(sale.clientReference)}
                        onRetry={() => void retrySale(sale)}
                        onDiscard={() => void discardSale(sale)}
                      />
                    ))}
                  </div>
                )}
              </div>

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
                      Consumo, perda e doação registrados sem conexão. O estoque local já está descontado.
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
                      <PendingWriteOffRow
                        key={writeOff.clientReference}
                        writeOff={writeOff}
                        confirming={confirmingDiscard === writeOff.clientReference}
                        onToggleConfirm={() => toggleConfirm(writeOff.clientReference)}
                        onRetry={() => void retryWriteOff(writeOff)}
                        onDiscard={() => void discardWriteOff(writeOff)}
                      />
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
