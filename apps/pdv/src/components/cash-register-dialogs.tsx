import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Unlock, DollarSign, FileText, Loader2, Lock } from "lucide-react";
import { parseAmount, round2 } from "@/lib/checkout";
import { formatCurrency } from "@workspace/core";
import type { CashRegisterSessionDto, CashRegisterSessionSummaryDto } from "@workspace/api-client-react";

interface OpenCashRegisterDialogProps {
  requiresOpenSession: boolean;
  sessionId: number | null;
  loadingSession: boolean;
  onOpenRegister: (value: number, obs: string) => Promise<void>;
  onLogout: () => void;
}

export function OpenCashRegisterDialog({
  requiresOpenSession,
  sessionId,
  loadingSession,
  onOpenRegister,
  onLogout,
}: OpenCashRegisterDialogProps) {
  const [aberturaValor, setAberturaValor] = useState("");
  const [aberturaObs, setAberturaObs] = useState("");
  const [abrindoCaixa, setAbrindoCaixa] = useState(false);

  const handleAbrirCaixa = async () => {
    setAbrindoCaixa(true);
    try {
      await onOpenRegister(parseAmount(aberturaValor), aberturaObs);
      setAberturaValor("");
      setAberturaObs("");
    } finally {
      setAbrindoCaixa(false);
    }
  };

  return (
    <Dialog open={requiresOpenSession && !sessionId && !loadingSession} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-card border-border shadow-2xl [&>button]:hidden">
        <div className="bg-primary/10 p-6 border-b border-border/50">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Unlock className="w-5 h-5 text-primary" /> Abertura de Caixa
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Informe o fundo de troco para começar a vender.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aberturaValor" className="text-sm font-semibold flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-primary" /> Fundo de Troco
            </Label>
            <Input
              id="aberturaValor"
              type="text"
              placeholder="R$ 0,00"
              className="h-12 text-lg font-mono"
              value={aberturaValor}
              onChange={(e) => setAberturaValor(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Dinheiro em espécie deixado na gaveta no início do turno.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aberturaObs" className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" /> Observações
            </Label>
            <textarea
              id="aberturaObs"
              placeholder="Opcional..."
              className="w-full min-h-[70px] p-3 rounded-lg border border-input bg-background/50 focus-visible:ring-primary/50 text-sm outline-none focus:border-primary transition-colors resize-none"
              value={aberturaObs}
              onChange={(e) => setAberturaObs(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1 cursor-pointer" onClick={onLogout}>
              Sair
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-primary to-orange-600 font-bold text-white border-none cursor-pointer"
              onClick={handleAbrirCaixa}
              disabled={abrindoCaixa}
            >
              {abrindoCaixa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Abrir Caixa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CloseCashRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: CashRegisterSessionSummaryDto | null;
  session: CashRegisterSessionDto | null;
  onCloseRegister: (value: number, obs: string) => Promise<unknown>;
}

export function CloseCashRegisterDialog({
  open,
  onOpenChange,
  summary,
  session,
  onCloseRegister,
}: CloseCashRegisterDialogProps) {
  const [fechamentoDinheiro, setFechamentoDinheiro] = useState("");
  const [fechamentoObs, setFechamentoObs] = useState("");
  const [fechandoCaixa, setFechandoCaixa] = useState(false);

  const confirmFecharCaixa = async () => {
    setFechandoCaixa(true);
    try {
      await onCloseRegister(parseAmount(fechamentoDinheiro), fechamentoObs);
      setFechamentoDinheiro("");
      setFechamentoObs("");
      onOpenChange(false);
    } finally {
      setFechandoCaixa(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border shadow-2xl">
        <div className="bg-primary/10 p-6 border-b border-border/50">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> Fechamento de Caixa
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Confirme os valores da sessão antes de encerrar o caixa.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/30">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total de Vendas</p>
              <p className="text-xl font-bold font-mono text-foreground">{summary?.salesCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Faturamento</p>
              <p className="text-xl font-bold font-mono text-primary">{formatCurrency(summary?.revenue ?? 0)}</p>
            </div>
            <div className="col-span-2 h-px bg-border/40 my-1" />
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Fundo de Troco</p>
              <p className="text-sm font-semibold font-mono">{formatCurrency(session?.openingBalance ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold">Recebido em Dinheiro</p>
              <p className="text-sm font-semibold font-mono">{formatCurrency(summary?.cashAmount ?? 0)}</p>
            </div>
            <div className="col-span-2 rounded-lg bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs text-primary uppercase font-bold">Esperado na Gaveta</p>
              <p className="text-lg font-bold font-mono text-primary">
                {formatCurrency(summary?.expectedCashAmount ?? 0)}
              </p>
            </div>

            {(summary?.byPaymentMethod.length ?? 0) > 0 && (
              <div className="col-span-2 space-y-1 pt-1">
                <p className="text-xs text-muted-foreground uppercase font-bold">Por Forma de Pagamento</p>
                {summary!.byPaymentMethod.map((entry) => (
                  <div key={entry.paymentMethodId} className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">
                      {entry.paymentMethodName} ({entry.count})
                    </span>
                    <span className="font-semibold">{formatCurrency(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {(summary?.cancelledSalesCount ?? 0) > 0 && (
              <p className="col-span-2 text-[11px] text-muted-foreground">
                {summary!.cancelledSalesCount} venda(s) cancelada(s) não entram no faturamento.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fechamentoDinheiro" className="text-sm font-semibold flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" /> Dinheiro em Espécie na Gaveta
              </Label>
              <Input
                id="fechamentoDinheiro"
                type="text"
                placeholder="R$ 0,00"
                className="h-12 text-lg font-mono"
                value={fechamentoDinheiro}
                onChange={(e) => setFechamentoDinheiro(e.target.value)}
                autoFocus
              />
              {(() => {
                const counted = parseAmount(fechamentoDinheiro);
                if (isNaN(counted)) return null;
                const diff = round2(counted - (summary?.expectedCashAmount ?? 0));
                if (Math.abs(diff) < 0.01) {
                  return <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Confere com o esperado.</p>;
                }
                return (
                  <p className="text-xs text-destructive font-semibold">
                    {diff > 0 ? "Sobra" : "Falta"} de {formatCurrency(Math.abs(diff))}.
                  </p>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechamentoObs" className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" /> Observações
              </Label>
              <textarea
                id="fechamentoObs"
                placeholder="Explique qualquer evento ou divergência ocorrida na sessão (opcional)..."
                className="w-full min-h-[80px] p-3 rounded-lg border border-input bg-background/50 focus-visible:ring-primary/50 text-sm outline-none focus:border-primary transition-colors resize-none"
                value={fechamentoObs}
                onChange={(e) => setFechamentoObs(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1 cursor-pointer" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-primary to-orange-600 font-bold hover:scale-105 active:scale-95 transition-transform cursor-pointer text-white border-none"
              onClick={confirmFecharCaixa}
              disabled={fechandoCaixa}
            >
              {fechandoCaixa ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Fechamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

