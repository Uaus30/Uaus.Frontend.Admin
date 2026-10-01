import { RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui";

/**
 * O que o painel mostra quando a consulta falha. Sem isto, o card ficava com a
 * animação de carregando para sempre e ninguém sabia que era a internet ou o
 * servidor.
 */
export function LoadError({ onRetry, className = "" }: { onRetry: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground ${className}`}
    >
      <span>Não foi possível carregar. Confira a internet.</span>
      <Button variant="outline" size="sm" className="gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" /> Tentar de novo
      </Button>
    </div>
  );
}
