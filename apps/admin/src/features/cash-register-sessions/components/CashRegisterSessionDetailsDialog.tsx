import { Loader2, Wallet } from "lucide-react";
import { CASH_REGISTER_SESSION_OPEN } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { formatCurrency, formatDate } from "@workspace/core";
import type { CashRegisterSessionDto } from "../types";

interface CashRegisterSessionDetailsDialogProps {
  /** Visibilidade do Dialog. */
  open: boolean;
  /** Chamado quando a visibilidade muda (fechar no X, Esc ou clique fora). */
  onOpenChange: (open: boolean) => void;
  /** Sessão detalhada, com o resumo consolidado do backend. */
  session: CashRegisterSessionDto | undefined;
  /** True enquanto o detalhe carrega. */
  isLoading: boolean;
}

/**
 * CashRegisterSessionDetailsDialog
 *
 * Detalhe de um turno de caixa: conferência da gaveta, resumo consolidado das
 * vendas (`summary`), tabela por forma de pagamento e observações.
 */
export function CashRegisterSessionDetailsDialog({
  open,
  onOpenChange,
  session,
  isLoading,
}: CashRegisterSessionDetailsDialogProps) {
  const summary = session?.summary ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Wallet className="h-5 w-5 text-primary" /> Detalhes do Turno de Caixa
            {session ? ` #${session.id}` : ""}
          </DialogTitle>
          <DialogDescription>
            Conferência da gaveta e resumo consolidado das vendas do turno.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        ) : session ? (
          <div className="space-y-6 py-4">
            {/* Identificação do turno */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Operador</p>
                <p className="mt-1 font-medium">
                  {session.userName || <span className="text-muted-foreground">Não informado</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                <div className="mt-1">
                  {session.status === CASH_REGISTER_SESSION_OPEN ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                      Aberto
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-medium">
                      Fechado
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Abertura</p>
                <p className="mt-1 font-medium">{formatDate(session.openedAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Fechamento</p>
                <p className="mt-1 font-medium">
                  {session.closedAt ? (
                    formatDate(session.closedAt)
                  ) : (
                    <span className="text-muted-foreground">Turno em andamento</span>
                  )}
                </p>
                {session.closedByUserName && (
                  <p className="text-xs text-muted-foreground">por {session.closedByUserName}</p>
                )}
              </div>
            </div>

            {/* Conferência da gaveta */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/50 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Fundo de troco</span>
                <span>{formatCurrency(session.openingBalance)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Esperado em gaveta</span>
                <span>
                  {session.expectedAmount != null
                    ? formatCurrency(session.expectedAmount)
                    : summary
                      ? formatCurrency(summary.expectedCashAmount)
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Contado no fechamento</span>
                <span>{session.countedAmount != null ? formatCurrency(session.countedAmount) : "—"}</span>
              </div>
              <div
                className={`mt-1 flex justify-between border-t border-border/50 pt-2 font-bold ${
                  session.difference != null && session.difference !== 0
                    ? "text-destructive"
                    : "text-emerald-600"
                }`}
              >
                <span>Diferença</span>
                <span>{session.difference != null ? formatCurrency(session.difference) : "—"}</span>
              </div>
            </div>

            {/* Resumo consolidado das vendas do turno */}
            {summary ? (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Faturamento</p>
                    <p className="mt-1 font-medium">{formatCurrency(summary.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Descontos</p>
                    <p className="mt-1 font-medium">{formatCurrency(summary.discounts)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Vendas</p>
                    <p className="mt-1 font-medium">
                      {summary.salesCount}
                      {summary.cancelledSalesCount > 0 && (
                        <span className="ml-1 text-xs text-destructive">
                          ({summary.cancelledSalesCount} canceladas)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Dinheiro × Outros</p>
                    <p className="mt-1 font-medium">
                      {formatCurrency(summary.cashAmount)} <span className="text-muted-foreground">×</span>{" "}
                      {formatCurrency(summary.nonCashAmount)}
                    </p>
                  </div>
                </div>

                {/* Por forma de pagamento */}
                {summary.byPaymentMethod.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-border/50">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/30 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2">Forma de pagamento</th>
                          <th className="px-4 py-2 text-center">Vendas</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.byPaymentMethod.map((row) => (
                          <tr key={row.paymentMethodId} className="border-b border-border/50 last:border-0">
                            <td className="px-4 py-3 font-medium">{row.paymentMethodName}</td>
                            <td className="px-4 py-3 text-center">{row.count}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Resumo do turno indisponível para esta sessão.</p>
            )}

            {/* Observações */}
            {session.openingNotes && (
              <div className="rounded-r border-l-2 border-primary/50 bg-primary/5 py-1 pl-3">
                <p className="text-xs text-muted-foreground">Observações da abertura</p>
                <p className="text-sm italic">{session.openingNotes}</p>
              </div>
            )}
            {session.closingNotes && (
              <div className="rounded-r border-l-2 border-primary/50 bg-primary/5 py-1 pl-3">
                <p className="text-xs text-muted-foreground">Observações do fechamento</p>
                <p className="text-sm italic">{session.closingNotes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar o detalhe desta sessão.
          </p>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
