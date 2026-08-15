import { AnimatePresence } from "framer-motion";
import { PauseCircle, ShoppingCart, Tag, Trash2 } from "lucide-react";
import { Button, ScrollArea, useToast } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { usePdvStore } from "@/stores/use-pdv-store";
import { PdvCartItem } from "./pdv-cart-item";

type PdvCartPanelProps = {
  /** Soma dos itens já com os descontos de linha. */
  subtotal: number;
  /** Subtotal menos o desconto da venda. É o que o checkout cobra. */
  total: number;
  /**
   * A loja usa controle de caixa e não há sessão aberta — o servidor recusaria
   * a venda, então o botão de finalizar não pode nem ser oferecido.
   */
  blockedWithoutSession: boolean;
  /** Abre o diálogo de desconto sobre o total da venda. */
  onApplyGlobalDiscount: () => void;
  /** Guarda a venda em espera e libera o caixa. */
  onHoldSale: () => void;
};

/**
 * Coluna direita do PDV: o que está sendo vendido, quanto dá e o que fazer com
 * isso.
 *
 * O total aparece em corpo grande porque é o número que o operador dita para o
 * cliente — ele precisa ser legível de pé, a um metro da tela.
 */
export function PdvCartPanel({
  subtotal,
  total,
  blockedWithoutSession,
  onApplyGlobalDiscount,
  onHoldSale,
}: PdvCartPanelProps) {
  const { toast } = useToast();

  const items = usePdvStore((state) => state.items);
  const globalDiscount = usePdvStore((state) => state.globalDiscount);
  const editingSaleId = usePdvStore((state) => state.editingSaleId);
  const applyGlobalDiscount = usePdvStore((state) => state.applyGlobalDiscount);
  const setCheckout = usePdvStore((state) => state.setCheckout);
  const cancelSale = usePdvStore((state) => state.cancelSale);

  return (
    <div className="w-[500px] flex flex-col bg-card shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-20 relative">
      <div className="p-6 border-b border-border/50 bg-muted/10 flex items-center justify-between">
        <h2 className="text-xl font-display font-bold flex items-center gap-2 uppercase">
          <ShoppingCart className="w-5 h-5 text-primary" /> Resumo da Venda
        </h2>
        {editingSaleId && (
          <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-bold uppercase">
            Editando #{editingSaleId}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-2">
          <AnimatePresence>
            {items.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground uppercase">Carrinho vazio</div>
            ) : (
              items.map((item) => <PdvCartItem key={item.id} item={item} />)
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="p-6 bg-muted/5 border-t border-border/50 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-muted-foreground text-sm">
            <span className="uppercase">Subtotal</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>

          {globalDiscount > 0 && (
            <div className="flex justify-between items-center text-emerald-500 font-bold text-sm">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> Desconto Total
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono">- {formatCurrency(globalDiscount)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-emerald-500 hover:text-destructive hover:bg-destructive/10 p-0 rounded cursor-pointer"
                  onClick={() => {
                    applyGlobalDiscount(0);
                    toast({
                      title: "Desconto Removido",
                      description: "O desconto total foi removido da venda.",
                      duration: 2000,
                    });
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Total Final</p>
          <p className="text-5xl font-mono font-bold text-foreground tracking-tight">{formatCurrency(total)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            className="h-14 font-bold text-xs tracking-widest border-primary/20 hover:bg-primary/5"
            onClick={onApplyGlobalDiscount}
            disabled={items.length === 0}
          >
            DESCONTO
          </Button>
          <Button
            className="h-14 font-bold text-sm tracking-widest bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20"
            disabled={items.length === 0 || blockedWithoutSession}
            onClick={setCheckout}
          >
            FINALIZAR
          </Button>
        </div>

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] font-bold tracking-wider text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 cursor-pointer disabled:opacity-40"
              onClick={onHoldSale}
              // Reedição mexe numa venda que já existe na API; pausá-la deixaria
              // a fila apontando para um registro que pode mudar por fora.
              disabled={editingSaleId !== null}
              title={
                editingSaleId
                  ? "Conclua ou descarte a edição antes de pausar"
                  : "Guardar esta venda e liberar o caixa"
              }
            >
              <PauseCircle className="w-3.5 h-3.5" /> PAUSAR
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] font-bold tracking-wider text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={cancelSale}
            >
              {editingSaleId ? "DESCARTAR EDIÇÃO" : "CANCELAR VENDA"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
