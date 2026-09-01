import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, isChunkLoadError, reloadOnChunkLoadError } from "@workspace/ui";
import { reportPdvError } from "@/lib/client-logger";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Rede de segurança do balcão: erro de render vira tela de recuperação, não
 * tela preta.
 *
 * O PDV era o único app sem barreira. Qualquer exceção durante a renderização
 * desmontava a árvore inteira, e o que sobrava era o fundo escuro do tema — foi
 * o que o operador viu ao finalizar a venda e ao mexer no zoom, em 01/09/2026,
 * sem nada explicando nem nada chegando ao servidor.
 *
 * Chunk velho depois de um deploy é tratado à parte: recarrega sozinho, porque
 * a correção é baixar o bundle novo e não há o que o operador decidir. Os
 * demais erros mostram a tela com o botão de recarregar e vão para o log.
 *
 * A venda em andamento não se perde na recarga: o carrinho e as vendas em
 * espera moram no armazenamento local, não na memória do React.
 */
export class PdvErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro capturado pelo PdvErrorBoundary:", error, errorInfo);

    // Bundle desatualizado pós-deploy: a recarga já resolve, e registrar isso
    // como crash crítico encheria o log de alarme falso.
    if (isChunkLoadError(error) && reloadOnChunkLoadError(error)) {
      return;
    }

    void reportPdvError(error, {
      origin: "[Front-PDV] Crash de Renderização",
      extraDetails: { componentStack: errorInfo.componentStack },
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-xl flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">O caixa precisa ser recarregado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu uma falha inesperada nesta tela. A venda em andamento e as vendas em espera continuam
              guardadas nesta máquina.
            </p>
          </div>

          {this.state.error?.message && (
            <div className="w-full max-h-24 overflow-auto rounded-lg border border-border/40 bg-muted/50 p-3 text-left font-mono text-xs text-muted-foreground">
              {this.state.error.message}
            </div>
          )}

          <Button className="w-full gap-2 bg-primary text-primary-foreground" onClick={this.handleReload}>
            <RotateCcw className="h-4 w-4" />
            Recarregar o PDV
          </Button>
        </div>
      </div>
    );
  }
}
