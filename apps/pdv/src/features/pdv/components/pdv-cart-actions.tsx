import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PauseCircle, Settings, Tag, Ticket, X } from "lucide-react";
import { Button } from "@workspace/ui";
import { COUPON_SHORTCUT_KEY } from "./coupon-dialog";

export type PdvCartActionsProps = {
  /** Há algo no carrinho. Sem itens não há o que descontar, pausar ou cancelar. */
  hasItems: boolean;
  /** ID da venda sendo reeditada, ou null numa venda nova. */
  editingSaleId: number | null;
  /**
   * A loja usa controle de caixa e não há sessão aberta — o servidor recusaria
   * a venda, então o botão de finalizar não pode nem ser oferecido.
   */
  blockedWithoutSession: boolean;
  /** Abre o checkout. */
  onCheckout: () => void;
  /** Abre o diálogo de desconto sobre o total da venda. */
  onDiscount: () => void;
  /** Abre o diálogo de cupom. */
  onCoupon: () => void;
  /** Guarda a venda em espera e libera o caixa. */
  onHoldSale: () => void;
  /** Pede a confirmação de cancelamento — nunca cancela direto. */
  onCancelSale: () => void;
};

/**
 * Reedição mexe numa venda que já existe na API; pausá-la deixaria a fila
 * apontando para um registro que pode mudar por fora.
 */
const holdTitle = (editingSaleId: number | null) =>
  editingSaleId ? "Conclua ou descarte a edição antes de pausar" : "Guardar esta venda e liberar o caixa";

/** Numa reedição o botão não descarta uma venda, e sim as alterações dela. */
const cancelLabel = (editingSaleId: number | null) => (editingSaleId ? "DESCARTAR EDIÇÃO" : "CANCELAR VENDA");

/**
 * `preventDefault` no mousedown: sem ele o clique traz o foco para o botão, e o
 * Radix devolveria o cursor PARA CÁ ao fechar o diálogo — o próximo bipe do
 * leitor seria digitado num botão e sumiria. Assim o foco nunca sai do campo de
 * busca, e é para lá que ele volta.
 */
const keepFocusOnSearch = (event: { preventDefault: () => void }) => event.preventDefault();

/**
 * Rodapé estendido: os quatro botões secundários sempre à vista.
 *
 * É o layout com que o PDV nasceu e continua sendo o padrão. Custa três faixas
 * de altura do rodapé — altura que a lista de itens não tem.
 */
export function PdvCartActionsExtended({
  hasItems,
  editingSaleId,
  blockedWithoutSession,
  onCheckout,
  onDiscount,
  onCoupon,
  onHoldSale,
  onCancelSale,
}: PdvCartActionsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-9 font-bold text-xs tracking-widest border-primary/20 hover:bg-primary/5"
          onClick={onDiscount}
          disabled={!hasItems}
        >
          DESCONTO
        </Button>
        <Button
          variant="outline"
          className="h-9 font-bold text-xs tracking-widest border-primary/20 hover:bg-primary/5"
          onMouseDown={keepFocusOnSearch}
          onClick={onCoupon}
          disabled={!hasItems}
          title={`Aplicar cupom de desconto (${COUPON_SHORTCUT_KEY})`}
        >
          CUPOM
        </Button>
      </div>

      <Button
        className="w-full h-12 font-bold text-sm tracking-widest bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20"
        disabled={!hasItems || blockedWithoutSession}
        onClick={onCheckout}
      >
        FINALIZAR
      </Button>

      {hasItems && (
        <div className="grid grid-cols-2 gap-1 -mt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[10px] font-bold tracking-wider text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 cursor-pointer disabled:opacity-40"
            onClick={onHoldSale}
            disabled={editingSaleId !== null}
            title={holdTitle(editingSaleId)}
          >
            <PauseCircle className="w-3.5 h-3.5" /> PAUSAR
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[10px] font-bold tracking-wider text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={onCancelSale}
          >
            {cancelLabel(editingSaleId)}
          </Button>
        </div>
      )}
    </>
  );
}

/**
 * Rodapé compacto: só o finalizar, com os quatro botões atrás da engrenagem.
 *
 * A gaveta é posicionada em `absolute` contra o RODAPÉ do resumo — quem renderiza
 * este componente precisa ser `relative` e `overflow-hidden`. É de propósito: ela
 * cobre a conta da venda, que é o espaço que sobra sem empurrar a lista de itens,
 * e o `overflow-hidden` esconde a gaveta enquanto ela desliza por fora da tela.
 *
 * Escape e clique fora fecham. São as duas saídas que o operador tenta primeiro,
 * e uma gaveta que só fecha pelo "x" cobre o total da venda no balcão.
 */
export function PdvCartActionsCompact({
  hasItems,
  editingSaleId,
  blockedWithoutSession,
  onCheckout,
  onDiscount,
  onCoupon,
  onHoldSale,
  onCancelSale,
}: PdvCartActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);

  // `pointerdown` em vez de `click` pelo mesmo motivo do menu sanduíche: no
  // touchscreen do balcão, esperar o `click` deixa a gaveta piscando por cima do
  // que foi tocado. O toque na própria engrenagem é ignorado porque ela já
  // alterna o estado — sem a guarda ela fecharia e reabriria no mesmo toque.
  useEffect(() => {
    if (!isOpen) return;

    const aoApontar = (event: PointerEvent) => {
      const alvo = event.target as Node;
      if (drawerRef.current?.contains(alvo) || gearRef.current?.contains(alvo)) return;
      setIsOpen(false);
    };

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", aoApontar);
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.removeEventListener("pointerdown", aoApontar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [isOpen]);

  /** Toda ação fecha a gaveta antes de agir: o que ela abre cobre a tela. */
  const run = (action: () => void) => () => {
    setIsOpen(false);
    action();
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          className="flex-1 h-12 font-bold text-sm tracking-widest bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/20"
          disabled={!hasItems || blockedWithoutSession}
          onClick={onCheckout}
        >
          FINALIZAR
        </Button>
        <Button
          ref={gearRef}
          variant="outline"
          // Quadrado da altura do finalizar: é botão de balcão, tocado com o
          // polegar, e um alvo menor que o dedo erraria o clique.
          className="h-12 w-12 shrink-0 border-primary/20 hover:bg-primary/5 cursor-pointer"
          onMouseDown={keepFocusOnSearch}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          title="Mais ações da venda"
        >
          <Settings className="w-5 h-5 text-primary" />
        </Button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-label="Ações da venda"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
            className="absolute inset-y-0 right-0 z-30 flex w-[15rem] max-w-full flex-col gap-2 rounded-l-xl border border-border/60 bg-card/80 p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Ações da Venda
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar ações da venda"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-9 gap-1 text-[10px] font-bold tracking-wider border-primary/20 hover:bg-primary/5 cursor-pointer"
                onClick={run(onDiscount)}
                disabled={!hasItems}
              >
                <Tag className="h-3.5 w-3.5" /> DESCONTO
              </Button>
              <Button
                variant="outline"
                className="h-9 gap-1 text-[10px] font-bold tracking-wider border-primary/20 hover:bg-primary/5 cursor-pointer"
                onMouseDown={keepFocusOnSearch}
                onClick={run(onCoupon)}
                disabled={!hasItems}
                title={`Aplicar cupom de desconto (${COUPON_SHORTCUT_KEY})`}
              >
                <Ticket className="h-3.5 w-3.5" /> CUPOM
              </Button>
              <Button
                variant="outline"
                className="h-9 gap-1 text-[10px] font-bold tracking-wider border-primary/20 hover:bg-primary/5 cursor-pointer disabled:opacity-40"
                onClick={run(onHoldSale)}
                disabled={!hasItems || editingSaleId !== null}
                title={holdTitle(editingSaleId)}
              >
                <PauseCircle className="h-3.5 w-3.5" /> PAUSAR
              </Button>
              <Button
                variant="outline"
                className="h-9 text-[10px] font-bold tracking-wider border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={run(onCancelSale)}
                disabled={!hasItems}
              >
                {cancelLabel(editingSaleId)}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
