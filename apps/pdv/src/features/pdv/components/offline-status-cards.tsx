import { AlertTriangle, Cloud, CloudOff, Database, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui";
import type { LocalDatabaseState } from "@/offline";
import { formatQueueTime } from "../lib/format-queue-time";

type ConnectionCardProps = {
  /** A API está respondendo. */
  online: boolean;
  /** Falso enquanto a primeira sondagem não terminou. */
  connectionChecked: boolean;
};

/**
 * Estado da conexão com o servidor.
 *
 * "Verificando" é um terceiro estado de propósito: dizer "sem conexão" antes da
 * primeira sondagem terminar faria o operador correr atrás do roteador por nada.
 */
export function ConnectionCard({ online, connectionChecked }: ConnectionCardProps) {
  return (
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
  );
}

type LocalDatabaseCardProps = {
  /** A base local já foi baixada alguma vez neste navegador. */
  hasLocalDatabase: boolean;
  snapshot: LocalDatabaseState | null;
  /** Um download de snapshot está em andamento. */
  refreshingSnapshot: boolean;
  online: boolean;
  snapshotError: string | null;
  onUpdate: () => void;
};

/**
 * Estado da base local e o botão de atualizá-la.
 *
 * A data importa mais do que parece: é ela que diz de quando são os preços e os
 * saldos que o PDV usaria numa queda de conexão.
 */
export function LocalDatabaseCard({
  hasLocalDatabase,
  snapshot,
  refreshingSnapshot,
  online,
  snapshotError,
  onUpdate,
}: LocalDatabaseCardProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/50 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Database
            className={`h-5 w-5 shrink-0 ${hasLocalDatabase ? "text-primary" : "text-destructive"}`}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Base local</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {hasLocalDatabase && snapshot?.downloadedAt
                ? `Atualizada em ${formatQueueTime(snapshot.downloadedAt)}`
                : "Nunca baixada — sem ela o PDV não vende offline."}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 cursor-pointer"
          onClick={onUpdate}
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
    </>
  );
}
