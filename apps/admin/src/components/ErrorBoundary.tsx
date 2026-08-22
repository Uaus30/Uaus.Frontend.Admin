import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@workspace/ui";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { reportClientError } from "../lib/clientLogger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary
 *
 * Captura exceções não tratadas durante a renderização da árvore React,
 * exibe uma interface amigável de recuperação e envia o log estruturado
 * para o backend através do clientLogger.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro capturado pelo ErrorBoundary:", error, errorInfo);

    void reportClientError(error, {
      type: 4, // 4 = Critical
      origin: `[Front-Admin] Crash de Renderização`,
      extraDetails: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/dashboard";
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full rounded-2xl border border-border/50 bg-card p-6 shadow-xl flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Algo deu errado</h2>
              <p className="text-sm text-muted-foreground">
                Ocorreu uma falha inesperada ao carregar esta tela. O erro foi registrado automaticamente para análise.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="w-full p-3 rounded-lg bg-muted/50 border border-border/40 text-xs font-mono text-left text-muted-foreground overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-2 w-full pt-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={this.handleGoHome}
              >
                <Home className="h-4 w-4" />
                Início
              </Button>
              <Button
                className="flex-1 gap-2 bg-primary text-primary-foreground"
                onClick={this.handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Recarregar
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
