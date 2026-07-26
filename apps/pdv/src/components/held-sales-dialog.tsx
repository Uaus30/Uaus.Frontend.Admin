import { useState } from "react";
import { PauseCircle, Play, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/formatters";
import { usePdvStore, type HeldSale } from "@/stores/use-pdv-store";

type HeldSalesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois que uma venda em espera volta para o carrinho. */
  onResumed: (sale: HeldSale) => void;
  /** Chamado quando a venda em andamento é pausada para abrir espaço. */
  onHeldToMakeRoom: () => void;
};

/** Descreve o consumidor da venda em espera para a listagem. */
function describeConsumer(sale: HeldSale) {
  const { name, document } = sale.consumer;
  return name.trim() || document.trim() || "Consumidor não identificado";
}

/**
 * Lista as vendas pausadas e permite retomar ou descartar cada uma.
 *
 * Retomar exige o carrinho vazio. Com uma venda em andamento, a tela oferece
 * pausar a atual antes de trazer a escolhida — assim nada é perdido no balcão.
 */
export function HeldSalesDialog({
  open,
  onOpenChange,
  onResumed,
  onHeldToMakeRoom,
}: HeldSalesDialogProps) {
  const heldSales = usePdvStore((state) => state.heldSales);
  const cartItems = usePdvStore((state) => state.items);
  const editingSaleId = usePdvStore((state) => state.editingSaleId);
  const resumeHeldSale = usePdvStore((state) => state.resumeHeldSale);
  const discardHeldSale = usePdvStore((state) => state.discardHeldSale);
  const holdSale = usePdvStore((state) => state.holdSale);

  /** Venda escolhida enquanto o operador confirma o que fazer com o carrinho atual. */
  const [pendingId, setPendingId] = useState<string | null>(null);

  const hasCart = cartItems.length > 0;

  const resume = (id: string) => {
    const resumed = resumeHeldSale(id);
    if (!resumed) return;

    setPendingId(null);
    onOpenChange(false);
    onResumed(resumed);
  };

  const handleResumeClick = (id: string) => {
    if (hasCart) {
      setPendingId(id);
      return;
    }
    resume(id);
  };

  const holdCurrentAndResume = () => {
    if (!pendingId) return;

    const held = holdSale();
    if (held) onHeldToMakeRoom();
    resume(pendingId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPendingId(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] p-0 overflow-hidden bg-card border-border shadow-2xl flex flex-col">
        <div className="bg-primary/10 p-6 border-b border-border/50 shrink-0">
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
            <PauseCircle className="w-6 h-6 text-primary" /> Vendas em Espera
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {heldSales.length === 0
              ? "Nenhuma venda pausada no momento."
              : "Retome uma venda pausada ou descarte a que não vai mais acontecer."}
          </DialogDescription>
        </div>

        <ScrollArea className="flex-1 p-6 min-h-[220px]">
          {heldSales.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
              Pause uma venda pelo botão <span className="font-semibold not-italic">PAUSAR</span> no
              resumo da venda para vê-la aqui.
            </div>
          ) : (
            <div className="space-y-3">
              {heldSales.map((sale, index) => {
                const isPending = pendingId === sale.id;
                const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);

                return (
                  <div
                    key={sale.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isPending ? "border-primary bg-primary/5" : "border-border/40 bg-background/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold">
                            Espera #{heldSales.length - index}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {new Date(sale.heldAt).toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {describeConsumer(sale)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                          <ShoppingCart className="h-3 w-3" />
                          {itemCount} {itemCount === 1 ? "item" : "itens"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-4">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Total</p>
                          <p className="font-mono text-lg font-bold text-primary">
                            {formatCurrency(sale.total)}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          className="gap-1.5 font-bold cursor-pointer"
                          onClick={() => handleResumeClick(sale.id)}
                        >
                          <Play className="h-3.5 w-3.5" /> Continuar
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          title="Descartar venda em espera"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                          onClick={() => {
                            discardHeldSale(sale.id);
                            if (isPending) setPendingId(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isPending && (
                      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs text-muted-foreground">
                          {editingSaleId
                            ? "Você está editando uma venda já registrada. Conclua ou descarte a edição antes de retomar esta venda."
                            : "Há uma venda em andamento no carrinho. Ela pode ser pausada para você retomar esta."}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 cursor-pointer"
                            onClick={() => setPendingId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 font-bold cursor-pointer"
                            disabled={editingSaleId !== null}
                            onClick={holdCurrentAndResume}
                          >
                            Pausar a atual e continuar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t border-border/50 bg-muted/10 flex justify-end shrink-0">
          <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
