import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ShoppingCart } from "lucide-react";
import { ScrollArea } from "@workspace/ui";
import type { PdvScreen } from "@/hooks/use-pdv-screen";
import { usePdvStore } from "@/stores/use-pdv-store";
import { toLocalTimestamp } from "@/services/sales.service";
import { describePromotions } from "@/lib/promotions";
import { useCouponDialog } from "../hooks/use-coupon";
import { useCustomerDialog } from "../hooks/use-customer-dialog";
import { ConfirmActionDialog } from "./confirm-action-dialog";
import { PdvCartActionsCompact } from "./pdv-cart-actions";
import { PdvCartCustomerCompact } from "./pdv-cart-customer-compact";
import { PdvCartItem } from "./pdv-cart-item";
import { PdvCartTotals } from "./pdv-cart-totals";

type PdvCartPanelProps = {
  /** Soma dos itens já com os descontos de linha. */
  subtotal: number;
  /** Subtotal menos o desconto da venda. É o que o checkout cobra. */
  total: number;
  /**
   * O servidor recusaria a venda, então o finalizar não pode nem ser oferecido:
   * caixa fechado numa loja com controle de caixa, ou conferência de estoque em
   * andamento (23/09/2026).
   */
  checkoutBlocked: boolean;
  /** Abre o diálogo de desconto sobre o total da venda. */
  onApplyGlobalDiscount: () => void;
  /** Guarda a venda em espera e libera o caixa. */
  onHoldSale: () => void;
  /** Forma da tela (ver `usePdvScreen`). */
  screen?: PdvScreen;
  /** Celular em pé: volta para a busca de produtos. */
  onBack?: () => void;
};

/**
 * Coluna direita do PDV: o que está sendo vendido, quanto dá e o que fazer com
 * isso.
 *
 * O total aparece em corpo grande porque é o número que o operador dita para o
 * cliente — ele precisa ser legível de pé, a um metro da tela.
 *
 * O rodapé é o compacto: só o FINALIZAR à vista, e cliente, desconto, cupom,
 * pausar e cancelar atrás da engrenagem. Até 07/10/2026 havia também o
 * estendido, com os botões sempre à vista, escolhido nas Preferências; ele saiu
 * a pedido do dono, junto com o PDV no celular — as três faixas de botões
 * custavam a altura da lista de itens, que no celular é a mais curta de todas.
 *
 * ## No celular (07/10/2026)
 *
 * - **Deitado**, continua coluna da direita, mas sem a faixa "Resumo da Venda"
 *   (60px de uma tela de ~390): a reedição, que era o único aviso dela, vira
 *   uma tira fina só quando acontece.
 * - **Em pé**, é a tela inteira, com "‹ Produtos" no topo para voltar à busca.
 * - Nos dois, as linhas são as compactas (`PdvCartItem`), e o rodapé é o mesmo
 *   do balcão: a gaveta da engrenagem mede a altura dele, e encolhê-lo cortaria
 *   PAUSAR e CANCELAR.
 */
export function PdvCartPanel({
  subtotal,
  total,
  checkoutBlocked,
  onApplyGlobalDiscount,
  onHoldSale,
  screen = "desk",
  onBack,
}: PdvCartPanelProps) {
  const phone = screen !== "desk";
  const items = usePdvStore((state) => state.items);
  const editingSaleId = usePdvStore((state) => state.editingSaleId);
  const promotions = usePdvStore((state) => state.promotions);
  // A lista CONGELADA da venda, com a viva como reserva — a mesma escolha de
  // `allocatedLines` no store. Ler a viva aqui faria o selo da linha contar uma
  // história e o total do rodapé contar outra assim que o tique de cinco minutos
  // trouxesse uma lista diferente no meio da venda.
  const salePromotions = usePdvStore((state) => state.salePromotions);
  const promotionInstant = usePdvStore((state) => state.promotionInstant);
  const releasedPromotions = usePdvStore((state) => state.releasedPromotions);
  const setCheckout = usePdvStore((state) => state.setCheckout);
  const cancelSale = usePdvStore((state) => state.cancelSale);
  const showCouponDialog = useCouponDialog((state) => state.show);
  const showCustomerDialog = useCustomerDialog((state) => state.show);
  const customerName = usePdvStore((state) => (state.consumer.name.trim() ? state.consumer.name : null));

  // A confirmação vive AQUI, e não na gaveta: ela fecha antes de agir, e a
  // pergunta precisa sobreviver a isso.
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  /**
   * A promoção de cada linha, calculada UMA vez para a lista inteira.
   *
   * Aqui, e não dentro de `PdvCartItem`: o limite por venda é do grupo e da
   * venda, então a alocação da terceira linha depende das duas anteriores — cada
   * linha calculando a sua daria a promoção cheia a todas elas. E um seletor por
   * item devolvendo objeto novo a cada leitura faria o zustand ver estado novo a
   * cada render.
   *
   * A reedição fica de fora pelo mesmo motivo do total (ver `allocatedLines` no
   * store): a parcela já está dentro do desconto gravado na venda.
   */
  const promotionByItem = describePromotions(
    editingSaleId === null ? items : [],
    salePromotions ?? promotions,
    promotionInstant ?? toLocalTimestamp(),
    releasedPromotions,
  );

  const actions = {
    hasItems: items.length > 0,
    editingSaleId,
    checkoutBlocked,
    onCheckout: setCheckout,
    onDiscount: onApplyGlobalDiscount,
    onCoupon: showCouponDialog,
    onHoldSale,
    onCancelSale: () => setConfirmCancelOpen(true),
    onCustomer: () => showCustomerDialog("search"),
    customerName,
  };

  return (
    // Largura em `rem`, não em `px`: o controle de tamanho do PDV escala a raiz,
    // e uma coluna fixa em pixel ficava estreita demais para o conteúdo maior —
    // era o que espremia a linha do item e obrigava a rolar. O teto em `vw`
    // impede que, na escala máxima, o resumo coma o espaço da busca.
    // Em pé o carrinho é a tela inteira (`w-full`), e não uma coluna.
    <div
      className={`${screen === "phone-portrait" ? "w-full" : "w-[31.25rem] max-w-[45vw]"} flex flex-col bg-card shrink-0 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.3)] z-20 relative`}
    >
      {screen === "desk" && (
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
      )}

      {screen === "phone-portrait" && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-muted/10 px-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-bold uppercase tracking-wider text-primary cursor-pointer active:bg-primary/10"
          >
            <ChevronLeft className="h-5 w-5" /> Produtos
          </button>
          {editingSaleId && (
            <span className="mr-2 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full font-bold uppercase">
              Editando #{editingSaleId}
            </span>
          )}
        </div>
      )}

      {screen === "phone-landscape" && editingSaleId && (
        <div className="shrink-0 bg-amber-500/15 px-3 py-1 text-center text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
          Editando a venda #{editingSaleId}
        </div>
      )}

      <ScrollArea className={`flex-1 min-h-0 ${phone ? "px-2 py-1.5" : "px-3 py-2"}`}>
        <div className={phone ? "space-y-1.5" : "space-y-2"}>
          <AnimatePresence>
            {items.length === 0 ? (
              <div className={`${phone ? "py-8" : "py-20"} text-center text-muted-foreground uppercase`}>
                Carrinho vazio
              </div>
            ) : (
              items.map((item) => (
                <PdvCartItem
                  key={item.id}
                  item={item}
                  promotion={promotionByItem.get(item.id)}
                  compact={phone}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/*
        `shrink-0` para o rodapé não ser espremido, e o resto compacto de
        propósito: cada rem que ele economiza é um item a mais visível na lista
        quando o operador aumenta a fonte.

        `relative` e `overflow-hidden` são o palco da gaveta da engrenagem: ela
        se posiciona contra este bloco e desliza de fora dele para dentro.
      */}
      {/* No celular, o respiro de baixo cresce até a barra do sistema do iPhone
          (a de deslizar, que fica no pé em pé E deitado), senão o FINALIZAR
          fica sob ela. */}
      <div
        className={`shrink-0 relative overflow-hidden p-3 bg-muted/5 border-t border-border/50 space-y-2 ${
          phone ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""
        }`}
      >
        <PdvCartCustomerCompact />
        <PdvCartTotals subtotal={subtotal} total={total} />
        <PdvCartActionsCompact {...actions} />
      </div>

      {/* Cancelar apaga a venda em andamento sem desfazer possível — vale a
          pergunta. */}
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
