import { motion } from "framer-motion";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, Input, useToast } from "@workspace/ui";
import { computeDiscount, formatCurrency, parseAmount } from "@workspace/core";
import { usePdvStore } from "@/stores/use-pdv-store";
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
 */
export function PdvCartItem({ item }: PdvCartItemProps) {
  const { toast } = useToast();
  const removeItem = usePdvStore((state) => state.removeItem);
  const updateQuantity = usePdvStore((state) => state.updateQuantity);
  const applyItemDiscount = usePdvStore((state) => state.applyItemDiscount);

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
      className="p-3 rounded-lg border border-border/40 bg-background/50 group"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-bold text-sm leading-tight">{item.name}</h4>
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
    </motion.div>
  );
}
