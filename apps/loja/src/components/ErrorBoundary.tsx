import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError, reloadOnChunkLoadError } from "@workspace/ui";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Última linha de defesa contra tela branca num site público.
 *
 * Erro de chunk pós-deploy tenta o auto-reload (uma vez, com trava) antes de
 * mostrar qualquer coisa; os demais viram uma mensagem amigável com botão de
 * recarregar. Diferente do admin, não loga no backend: o endpoint /Logs exige
 * autenticação e o visitante é anônimo — o console é o registro possível.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnChunkLoadError(error)) {
      // O reload vai acontecer; não vale poluir o console com o crash.
      return;
    }

    console.error("[Front-Loja] Crash de renderização", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50/30 px-6 text-center">
          <h1 className="text-3xl font-black text-foreground">Ops! Algo deu errado</h1>
          <p className="max-w-md text-muted-foreground">
            Ocorreu um problema ao carregar a página. Recarregue e, se persistir, fale com a gente pelo
            WhatsApp.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-gradient-to-r from-primary to-orange-400 px-8 py-3 font-bold text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl"
          >
            Recarregar a página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
