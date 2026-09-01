import { useEffect, useState } from "react";
import { History, Loader2, Printer, MoreVertical, FileBarChart } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@workspace/ui";
import { ScrollArea } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Hint } from "./hint";
import { formatCurrency } from "@workspace/core";
import { enumCode, PAYMENT_STATUS, type SaleDto } from "@workspace/api-client-react";

export interface SalesHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queuedSalesCount: number;
  loadingSales: boolean;
  sales: SaleDto[];
  busySaleId: number | null;
  /** A loja usa controle de caixa: o relatório impresso é o do turno. */
  usesCashRegister: boolean;
  /** Operador logado. Decide quais vendas ele pode editar e cancelar. */
  currentUserId: number | null;
  printingReport: boolean;
  /** Recarrega as vendas do dia; chamado toda vez que o histórico abre. */
  onRefresh: () => void;
  onPrintSaleReceipt: (sale: SaleDto) => void;
  onEditSale: (sale: SaleDto) => void;
  onCancelSale: (sale: SaleDto) => void;
  onPrintSalesReport: () => void;
}

export function SalesHistoryDialog({
  open,
  onOpenChange,
  queuedSalesCount,
  loadingSales,
  sales,
  busySaleId,
  usesCashRegister,
  currentUserId,
  printingReport,
  onRefresh,
  onPrintSaleReceipt,
  onEditSale,
  onCancelSale,
  onPrintSalesReport,
}: SalesHistoryDialogProps) {
  const [activeRowMenuId, setActiveRowMenuId] = useState<number | null>(null);

  /**
   * Abrir o histórico recarrega a lista.
   *
   * O diálogo fica montado o tempo todo, então a consulta só era refeita depois
   * de uma venda DESTE caixa: as vendas que o colega registrou no outro balcão
   * não apareciam enquanto a página não fosse recarregada.
   */
  useEffect(() => {
    if (open) onRefresh();
    // `onRefresh` fora das dependências de propósito: a identidade dele muda
    // junto com a sessão, e isso recarregaria a lista fora da abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] p-0 overflow-hidden bg-card border-border shadow-2xl flex flex-col">
        <div className="bg-primary/10 p-6 border-b border-border/50 shrink-0">
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Vendas de Hoje
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {/* A lista é do DIA da loja, e não do turno de quem está logado: o
                cliente que volta para trocar precisa ser encontrado por quem
                estiver no balcão. Editar e cancelar continuam com o autor. */}
            Todas as vendas de hoje na loja, das mais recentes para as mais antigas. Editar e cancelar só
            valem para as vendas registradas por você.
          </DialogDescription>
          {queuedSalesCount > 0 && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              {queuedSalesCount} venda(s) registrada(s) offline ainda não aparecem aqui — elas estão na fila
              local. Consulte o indicador de conexão no topo da tela.
            </p>
          )}
        </div>

        <ScrollArea className="flex-1 p-6 min-h-[350px]">
          {loadingSales ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto w-6 h-6 animate-spin text-primary" />
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground italic">
              Nenhuma venda registrada hoje.
            </div>
          ) : (
            <div className="space-y-3 pb-20">
              {sales.map((sale) => {
                const isCancelled = enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled;

                /**
                 * O operador logado pode alterar esta venda.
                 *
                 * Reimprimir é liberado para todos — o cliente que volta tem que
                 * ser atendido por quem estiver no balcão. Editar e cancelar
                 * mexem em dinheiro e estoque, e ficam com o autor.
                 *
                 * Venda SEM autor identificado é liberada: são as registradas
                 * antes de a coluna existir, e bloqueá-las deixaria um pedaço do
                 * histórico intocável para sempre.
                 */
                const podeAlterar =
                  sale.userId == null || currentUserId == null || sale.userId === currentUserId;
                const methodNames = (sale.payments ?? [])
                  .map((p) => p.paymentMethodName)
                  .filter(Boolean)
                  .join(" + ");

                return (
                  <div
                    key={sale.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isCancelled
                        ? "bg-destructive/5 border-destructive/20 opacity-70"
                        : "bg-background/50 border-border/40 hover:border-primary/20"
                    }`}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">#{sale.id}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(sale.createdAt).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {isCancelled ? (
                          <span className="text-[10px] bg-destructive/15 text-destructive px-2 py-0.5 rounded-full font-bold uppercase">
                            Cancelada
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
                            Finalizada
                          </span>
                        )}
                        <span className="text-[10px] bg-muted border border-border/30 text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase font-mono">
                          {methodNames || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-12">
                      <div className="text-right min-w-[100px]">
                        <p className="text-xs text-muted-foreground uppercase font-bold">Valor Total</p>
                        <p
                          className={`font-mono text-lg font-bold ${
                            isCancelled ? "line-through text-muted-foreground" : "text-primary"
                          }`}
                        >
                          {formatCurrency(sale.total)}
                        </p>
                      </div>

                      <div className="relative flex items-center gap-1">
                        <Hint label="Reimprimir cupom">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => onPrintSaleReceipt(sale)}
                            disabled={busySaleId === sale.id}
                            aria-label="Reimprimir cupom"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        </Hint>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => setActiveRowMenuId(activeRowMenuId === sale.id ? null : sale.id)}
                          disabled={isCancelled || busySaleId === sale.id || !podeAlterar}
                          // `title` nativo, e não o `Hint`: esta dica só existe
                          // quando o botão está DESABILITADO, e botão desabilitado
                          // não dispara evento de ponteiro — o tooltip do Radix
                          // nunca abriria justamente no caso que ele explica.
                          title={
                            podeAlterar
                              ? undefined
                              : `Venda registrada por ${sale.userName || "outro operador"} — só quem registrou pode editar ou cancelar.`
                          }
                        >
                          {busySaleId === sale.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MoreVertical className="w-4 h-4" />
                          )}
                        </Button>

                        {activeRowMenuId === sale.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveRowMenuId(null)} />
                            <div className="absolute right-0 mt-1 w-32 rounded-lg border border-border bg-popover p-1 shadow-lg z-50">
                              <button
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  onEditSale(sale);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-semibold hover:bg-muted text-foreground transition-colors text-left cursor-pointer"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  onCancelSale(sale);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-semibold hover:bg-destructive/10 text-destructive transition-colors text-left cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-muted/10 flex justify-between gap-2 shrink-0">
          <Button
            variant="outline"
            className="gap-2 cursor-pointer"
            onClick={onPrintSalesReport}
            // Sem sessão o relatório é o do DIA — o botão não pode ficar morto
            // numa loja que não usa controle de caixa e nunca terá turno.
            disabled={printingReport}
          >
            {printingReport ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileBarChart className="w-4 h-4" />
            )}
            {usesCashRegister ? "Imprimir Relatório do Turno" : "Imprimir Relatório do Dia"}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="cursor-pointer">
            Fechar Histórico
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
