import { motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, Input, useToast } from "@workspace/ui";
import { computeDiscount, formatCurrency, parseAmount } from "@workspace/core";
import { usePdvStore } from "@/stores/use-pdv-store";
import { PdvCartItemImage } from "./pdv-cart-item-image";
import type { PdvItem } from "../types";

type PdvCartItemProps = {
  item: PdvItem;
};

/**
 * Uma linha do carrinho: quantidade, preço unitário editável e o total do item.
 *
 * O preço unitário é editável direto na linha porque é assim que o balcão
 * negocia — o operador digita o valor combinado, e a diferença para a tabela
 * vira desconto do item. Nunca o contrário: um preço acima do de tabela é
 * recusado, senão a venda gravaria "desconto negativo" e o relatório de
 * descontos deixaria de fechar.
 *
 * ## O realce do item recém-bipado
 *
 * Substituiu o toast de "item adicionado", em 01/09/2026. O aviso aparecia no
 * canto oposto ao carrinho e durava mais que o bipe seguinte: numa sequência
 * rápida o operador via um aviso empilhado sobre o outro e não sabia qual linha
 * tinha acabado de entrar. O contorno pulsa UMA vez na própria linha — a
 * confirmação acontece onde o item foi parar.
 */
export function PdvCartItem({ item }: PdvCartItemProps) {
  const { toast } = useToast();
  const removeItem = usePdvStore((state) => state.removeItem);
  const updateQuantity = usePdvStore((state) => state.updateQuantity);
  const applyItemDiscount = usePdvStore((state) => state.applyItemDiscount);

  // Zero quando o bipe foi em outra linha. O número (e não um booleano) é o que
  // reinicia a animação quando o MESMO produto é bipado de novo: ele muda, a
  // `key` do contorno muda junto e o pulso recomeça do zero.
  const pulseSeq = usePdvStore((state) => (state.lastAddedItemId === item.id ? state.lastAddedSeq : 0));

  /**
   * Aplica o preço digitado como desconto do item.
   *
   * @param inputEl Campo digitado, para devolver o valor anterior quando o
   *   digitado é recusado — deixar o número inválido na tela faria o operador
   *   acreditar que ele valeu.
   */
  const handleUpdateUnitPrice = (valueStr: string, inputEl?: HTMLInputElement) => {
    const restore = () => {
      if (inputEl) inputEl.value = (item.price - item.discount).toFixed(2).replace(".", ",");
    };

    // A conta e os limites saem do @workspace/core, o mesmo módulo do diálogo de
    // desconto e do total do carrinho — três caminhos, uma regra só.
    const val = parseAmount(valueStr);
    const resultado = computeDiscount({
      base: item.price,
      value: Number.isNaN(val) ? NaN : item.price - val,
      type: "value",
    });

    if ("error" in resultado) {
      const acimaDaTabela = resultado.error === "negativo";
      toast({
        title: acimaDaTabela ? "Valor Superior ao Original" : "Valor Inválido",
        description: acimaDaTabela
          ? `O valor do item não pode ser superior ao preço original de ${formatCurrency(item.price)}.`
          : "Por favor, digite um preço unitário válido.",
        variant: "destructive",
      });
      restore();
      return;
    }

    const discount = resultado.amount;
    applyItemDiscount(item.id, discount);
    toast({
      title: discount > 0 ? "Preço Atualizado" : "Preço Restaurado",
      description:
        discount > 0
          ? `Desconto de ${formatCurrency(discount)} aplicado no item.`
          : "O preço original do item foi restaurado.",
      duration: 2000,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="relative flex items-stretch gap-3 p-3 rounded-lg border border-border/40 bg-background/50 group"
    >
      {/* O contorno é uma camada por cima, não a borda da linha: animar a borda
          empurraria o conteúdo meio pixel e a lista inteira tremeria.

          A `key` é o contador do bipe, e é ela que faz o pulso recomeçar quando o
          mesmo produto é lido duas vezes seguidas: chave nova remonta o nó, e
          animação de CSS só reinicia com nó novo.

          O nó fica montado depois de pulsar, em vez de sair por um estado que o
          `onAnimationEnd` desligaria: a classe é transparente em repouso, então
          o que sobra é invisível e não recebe clique — e o componente não
          precisa de `setState` dentro de efeito para nada. */}
      {pulseSeq > 0 && (
        <span
          key={pulseSeq}
          aria-hidden
          data-testid="cart-item-pulse"
          className="pdv-item-pulse pointer-events-none absolute inset-0 z-10 rounded-lg border-2 border-primary"
        />
      )}

      {/* Coluna própria, esticada na altura inteira do card (`self-stretch`), e
          não uma miniatura no meio do texto: assim a foto acompanha o card
          quando o nome quebra em duas linhas, e quantidade, preço e total ficam
          SEMPRE à direita dela, na mesma coluna, em todas as linhas do carrinho. */}
      <PdvCartItemImage name={item.name} imageUrl={item.imageUrl} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="min-w-0 flex-1">
            {/* Nome INTEIRO, quebrando em quantas linhas precisar: é a mesma regra
              da lista de busca. O fim do nome é o que separa duas variações do
              mesmo produto ("...CONICA" × "...RETA"), e truncar escondia
              justamente isso — o operador via duas linhas idênticas no carrinho. */}
            <h4 className="font-bold text-sm leading-tight break-words">{item.name}</h4>
            <span className="text-[10px] text-muted-foreground font-mono">{item.barcode}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(item.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground">Quantidade:</span>
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-1 border border-border/30">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
              >
                <Minus className="w-2 h-2" />
              </Button>
              <span className="font-mono text-xs font-bold w-4 text-center">{item.quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  // O saldo é o do momento em que o item entrou no carrinho: vender
                  // acima dele quebraria a venda offline na conferência local.
                  if (item.quantity + 1 > item.availableStock) {
                    toast({
                      title: "Estoque insuficiente",
                      description: `Só há ${item.availableStock} unidade(s) de ${item.name}.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  updateQuantity(item.id, item.quantity + 1);
                }}
              >
                <Plus className="w-2 h-2" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground">Valor Unitário:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-semibold">R$</span>
              <Input
                type="text"
                className="w-16 h-7 text-xs font-mono font-bold px-1.5 py-0 text-center bg-background border-border focus-visible:ring-primary shadow-sm"
                // A `key` com o desconto força o campo a remontar quando o valor
                // muda por fora (diálogo de desconto), já que ele é não controlado.
                key={`${item.id}-${item.discount}`}
                defaultValue={(item.price - item.discount).toFixed(2).replace(".", ",")}
                onBlur={(e) => handleUpdateUnitPrice(e.target.value, e.target)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUpdateUnitPrice((e.target as HTMLInputElement).value, e.target as HTMLInputElement);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
            </div>
          </div>

          <div className="text-right flex flex-col justify-end items-end h-[52px]">
            <div className="flex flex-col">
              {item.discount > 0 && (
                <span className="text-[10px] text-emerald-500 line-through leading-none mb-0.5">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              )}
              <span className="font-mono font-bold text-primary leading-none">
                {formatCurrency((item.price - item.discount) * item.quantity)}
              </span>
            </div>
            {item.discount > 0 ? (
              <Button
                variant="link"
                size="sm"
                className="h-4 p-0 text-[10px] text-emerald-500 hover:text-destructive transition-colors font-semibold"
                onClick={() => {
                  applyItemDiscount(item.id, 0);
                  toast({
                    title: "Desconto Removido",
                    description: "O preço original do item foi restaurado.",
                    duration: 2000,
                  });
                }}
              >
                Remover Desconto
              </Button>
            ) : (
              <div className="h-4" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
