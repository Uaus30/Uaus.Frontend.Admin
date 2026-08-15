import { RotateCcw, Trash2 } from "lucide-react";
import { STOCK_WRITE_OFF_REASON_LABEL } from "@workspace/api-client-react";
import { Button } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { PendingSale, PendingWriteOff } from "@/offline";
import { formatQueueTime } from "../lib/format-queue-time";

/** Selo "A enviar" / "Recusada" de um movimento da fila. */
function StatusBadge({ failed }: { failed: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        failed ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      }`}
    >
      {failed ? "Recusada" : "A enviar"}
    </span>
  );
}

type RowActionsProps = {
  onRetry: () => void;
  onAskDiscard: () => void;
  discardTitle: string;
};

/** Reenviar ou descartar — só aparecem no movimento que o servidor recusou. */
function RowActions({ onRetry, onAskDiscard, discardTitle }: RowActionsProps) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-primary"
        title="Tentar enviar novamente"
        onClick={onRetry}
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
        title={discardTitle}
        onClick={onAskDiscard}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );
}

type DiscardConfirmProps = {
  message: string;
  onKeep: () => void;
  onDiscard: () => void;
};

/**
 * Confirmação de descarte, embutida na própria linha.
 *
 * Um diálogo por cima do painel esconderia justamente o movimento que o operador
 * precisa reconhecer antes de jogar fora.
 */
function DiscardConfirm({ message, onKeep, onDiscard }: DiscardConfirmProps) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2">
      <span className="text-[11px] font-medium text-destructive">{message}</span>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" className="h-7 cursor-pointer text-xs" onClick={onKeep}>
          Manter
        </Button>
        <Button size="sm" variant="destructive" className="h-7 cursor-pointer text-xs" onClick={onDiscard}>
          Descartar
        </Button>
      </div>
    </div>
  );
}

type PendingSaleRowProps = {
  sale: PendingSale;
  /** A confirmação de descarte desta venda está aberta. */
  confirming: boolean;
  onToggleConfirm: () => void;
  onRetry: () => void;
  onDiscard: () => void;
};

/** Uma venda esperando para subir, ou recusada pelo servidor. */
export function PendingSaleRow({ sale, confirming, onToggleConfirm, onRetry, onDiscard }: PendingSaleRowProps) {
  const failed = sale.status === "failed";

  return (
    <div
      className={`rounded-lg border p-3 ${
        failed ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Número provisório: a venda ainda não tem ID no banco. */}
            <span className="font-mono text-sm font-bold">OFF-{sale.offlineNumber}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{formatQueueTime(sale.occurredAt)}</span>
            <StatusBadge failed={failed} />
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {sale.items.length} item(ns) · {sale.items.map((item) => item.productName).join(", ")}
          </p>
          {sale.lastError && (
            // Altura limitada e rolagem própria: a mensagem vem do servidor e não
            // tem tamanho previsível.
            <p className="mt-1 max-h-20 overflow-y-auto break-words text-[11px] font-medium text-destructive">
              {sale.lastError}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-sm font-bold text-primary">{formatCurrency(sale.total)}</span>
          {failed && (
            <RowActions onRetry={onRetry} onAskDiscard={onToggleConfirm} discardTitle="Descartar a venda" />
          )}
        </div>
      </div>

      {confirming && (
        <DiscardConfirm
          message="Descartar esta venda? Ela não será gravada no servidor."
          onKeep={onToggleConfirm}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
}

type PendingWriteOffRowProps = {
  writeOff: PendingWriteOff;
  confirming: boolean;
  onToggleConfirm: () => void;
  onRetry: () => void;
  onDiscard: () => void;
};

/** Uma baixa de estoque esperando para subir, ou recusada pelo servidor. */
export function PendingWriteOffRow({
  writeOff,
  confirming,
  onToggleConfirm,
  onRetry,
  onDiscard,
}: PendingWriteOffRowProps) {
  const failed = writeOff.status === "failed";

  return (
    <div
      className={`rounded-lg border p-3 ${
        failed ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">
              {STOCK_WRITE_OFF_REASON_LABEL[writeOff.reason] ?? "Baixa"}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatQueueTime(writeOff.occurredAt)}
            </span>
            <StatusBadge failed={failed} />
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {writeOff.items.map((item) => `${item.quantity}x ${item.productName}`).join(", ")}
          </p>
          {writeOff.lastError && (
            <p className="mt-1 max-h-20 overflow-y-auto break-words text-[11px] font-medium text-destructive">
              {writeOff.lastError}
            </p>
          )}
        </div>

        {failed && (
          <div className="flex shrink-0 items-center gap-2">
            <RowActions onRetry={onRetry} onAskDiscard={onToggleConfirm} discardTitle="Descartar a baixa" />
          </div>
        )}
      </div>

      {confirming && (
        <DiscardConfirm
          message="Descartar esta baixa? Ela não será gravada no servidor."
          onKeep={onToggleConfirm}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
}
