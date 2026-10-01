import { CloudAlert, CloudCheck, Loader2 } from "lucide-react";
import { Button } from "@workspace/ui";
import type { DraftLoadState, DraftSaveState } from "../hooks/useLabelDraft";

export interface DraftStatusProps {
  loadState: DraftLoadState;
  saveState: DraftSaveState;
  savedAt: Date | null;
  onRetryLoad: () => void;
  onRetrySave: () => void;
}

/** "14:32", no relógio deste aparelho. */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Situação da lista salva, no cabeçalho da lista.
 *
 * Existe para a pessoa confiar em fechar o celular no meio da prateleira: sem
 * um "salvo às 14:32" à vista, a única forma de saber seria fechar e reabrir.
 * Falha de gravação aparece com o botão de tentar de novo — a lista continua na
 * tela, mas não chegou ao servidor.
 */
export function DraftStatus({ loadState, saveState, savedAt, onRetryLoad, onRetrySave }: DraftStatusProps) {
  if (loadState === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo a lista salva...
      </p>
    );
  }

  if (loadState === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
        <CloudAlert className="h-3.5 w-3.5" />
        Não foi possível abrir a lista salva.
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onRetryLoad}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (saveState === "saving") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando...
      </p>
    );
  }

  if (saveState === "error") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
        <CloudAlert className="h-3.5 w-3.5" />
        Não foi possível salvar a lista.
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onRetrySave}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (saveState === "saved" && savedAt) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CloudCheck className="h-3.5 w-3.5" /> Lista salva às {formatTime(savedAt)}
      </p>
    );
  }

  return null;
}
