import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { ScrollArea } from "@workspace/ui";
import { usePdvStore } from "@/stores/use-pdv-store";
import { useCouponDialog } from "../hooks/use-coupon";
import { ConfirmActionDialog } from "./confirm-action-dialog";
import { PdvCartActionsCompact, PdvCartActionsExtended } from "./pdv-cart-actions";
import { PdvCartItem } from "./pdv-cart-item";
import { PdvCartTotals } from "./pdv-cart-totals";

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
 *
 * O rodapé tem dois layouts, escolhidos nas Preferências do terminal: o
 * estendido, com os quatro botões secundários à vista, e o compacto, que os
 * guarda atrás de uma engrenagem. Ver `CartLayout` no store.
 */
export function PdvCartPanel({
  subtotal,
  total,
  blockedWithoutSession,
  onApplyGlobalDiscount,
  onHoldSale,
}: PdvCartPanelProps) {
  const items = usePdvStore((state) => state.items);
  const editingSaleId = usePdvStore((state) => state.editingSaleId);
  const cartLayout = usePdvStore((state) => state.cartLayout);
  const setCheckout = usePdvStore((state) => state.setCheckout);
  const cancelSale = usePdvStore((state) => state.cancelSale);
  const showCouponDialog = useCouponDialog((state) => state.show);

  // A confirmação vive AQUI, e não em cada layout: os dois disparam o mesmo
  // cancelamento, e duplicar o estado faria a pergunta divergir entre eles.
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const actions = {
    hasItems: items.length > 0,
    editingSaleId,
    blockedWithoutSession,
    onCheckout: setCheckout,
    onDiscount: onApplyGlobalDiscount,
    onCoupon: showCouponDialog,
    onHoldSale,
    onCancelSale: () => setConfirmCancelOpen(true),
  };

  return (
    // Largura em `rem`, não em `px`: o controle de tamanho do PDV escala a raiz,
    // e uma coluna fixa em pixel ficava estreita demais para o conteúdo maior —
    // era o que espremia a linha do item e obrigava a rolar. O teto em `vw`
    // impede que, na escala máxima, o resumo coma o espaço da busca.
    <div className="w-[31.25rem] max-w-[45vw] flex flex-col bg-card shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-20 relative">
      <div className="px-5 py-4 border-b border-border/50 bg-muted/10 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-display font-bold flex items-center gap-2 uppercase">
          <ShoppingCart className="w-5 h-5 text-primary" /> Resumo da Venda
        </h2>
        {editingSaleId && (
          <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-bold uppercase">
            Editando #{editingSaleId}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 px-3 py-2">
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

      {/*
        `shrink-0` para o rodapé não ser espremido, e o resto compacto de
        propósito: cada rem que ele economiza é um item a mais visível na lista
        quando o operador aumenta a fonte.

        `relative` e `overflow-hidden` são o palco da gaveta do layout compacto:
        ela se posiciona contra este bloco e desliza de fora dele para dentro.
      */}
      <div className="shrink-0 relative overflow-hidden p-3 bg-muted/5 border-t border-border/50 space-y-2">
        <PdvCartTotals subtotal={subtotal} total={total} />

        {cartLayout === "compact" ? (
          <PdvCartActionsCompact {...actions} />
        ) : (
          <PdvCartActionsExtended {...actions} />
        )}
      </div>

      {/* Cancelar apaga a venda em andamento sem desfazer possível — vale a
          pergunta, nos dois layouts. */}
      <ConfirmActionDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title={editingSaleId ? "Descartar esta edição?" : "Cancelar esta venda?"}
        description={
          editingSaleId
            ? `As alterações feitas na venda #${editingSaleId} serão perdidas e ela volta a valer como estava registrada. Esta ação é irreversível.`
            : "Todos os itens do carrinho, descontos e cupons desta venda serão perdidos. Esta ação é irreversível."
        }
        confirmLabel={editingSaleId ? "Descartar edição" : "Confirmar"}
        onConfirm={cancelSale}
      />
    </div>
  );
}
