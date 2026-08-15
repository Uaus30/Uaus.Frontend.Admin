import { useState } from "react";
import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@workspace/ui";
import { Button, Input, Label } from "@workspace/ui";
import { computeDiscount, parseAmount } from "@workspace/core";
import { useToast } from "@/hooks/use-toast";
import type { PdvItem } from "@/stores/use-pdv-store";

export type DiscountTarget = { type: "global" | "item"; id?: string };

export interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DiscountTarget;
  globalDiscount: number;
  items: PdvItem[];
  subtotal: number;
  applyGlobalDiscount: (value: number) => void;
  applyItemDiscount: (id: string, value: number) => void;
}

export function DiscountDialog({
  open,
  onOpenChange,
  target,
  globalDiscount,
  items,
  subtotal,
  applyGlobalDiscount,
  applyItemDiscount,
}: DiscountDialogProps) {
  const { toast } = useToast();
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"value" | "percent">("value");

  /** Desconto já aplicado no alvo, que o campo mostra quando o diálogo abre. */
  const discountInForce = () => {
    if (target.type === "global") {
      return globalDiscount > 0 ? globalDiscount.toString() : "";
    }
    if (target.id) {
      const item = items.find((i) => i.id === target.id);
      return item?.discount && item.discount > 0 ? item.discount.toString() : "";
    }
    return "";
  };

  // Reset feito durante a renderização, não num efeito: o campo já sai com o
  // valor certo no primeiro paint. O efeito anterior reagia também a `items` e
  // `globalDiscount`, então qualquer mexida no carrinho com o diálogo aberto
  // apagava o que o operador estava digitando.
  const openedFor = open ? `${target.type}:${target.id ?? ""}` : null;
  const [resetFor, setResetFor] = useState<string | null>(null);
  if (openedFor !== null && openedFor !== resetFor) {
    setResetFor(openedFor);
    setDiscountType("value");
    setDiscountValue(discountInForce());
  }

  const confirmDiscount = () => {
    const informado = parseAmount(discountValue);
    // Alvo define a base do desconto: a venda inteira, ou o preço unitário da
    // linha. A conta e os limites são do @workspace/core — o mesmo módulo que o
    // store usa para o total e que o cupom vai usar.
    const item = target.type === "item" && target.id
      ? items.find((i) => i.id === target.id)
      : undefined;

    if (target.type === "item" && !item) return;

    const base = target.type === "global" ? subtotal : (item?.price ?? 0);
    const resultado = computeDiscount({ base, value: informado, type: discountType });

    if ("error" in resultado) {
      if (resultado.error === "invalido") return;

      toast({
        title: "Desconto Inválido",
        description:
          resultado.error === "negativo"
            ? "O desconto não pode ser negativo."
            : target.type === "global"
              ? "O desconto não pode ser maior que o subtotal da venda."
              : "O desconto não pode ser maior que o valor do item.",
        variant: "destructive",
      });
      return;
    }

    if (target.type === "global") {
      applyGlobalDiscount(resultado.amount);
    } else if (item) {
      applyItemDiscount(item.id, resultado.amount);
    }

    toast({ title: "Desconto Aplicado", duration: 2000 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-6 bg-card border-border shadow-2xl">
        <DialogTitle className="text-xl font-bold flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          Conceder Desconto {target.type === "item" ? "(Item)" : "Total"}
        </DialogTitle>
        <div className="mt-6 space-y-6">
          <div className="flex gap-2">
            <Button
              variant={discountType === "value" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setDiscountType("value")}
            >
              R$ Valor
            </Button>
            <Button
              variant={discountType === "percent" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setDiscountType("percent")}
            >
              % Porcentagem
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Quanto de desconto?</Label>
            <Input
              type="text"
              placeholder={discountType === "value" ? "R$ 0,00" : "0 %"}
              className="h-12 text-lg font-mono"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {((target.type === "global" && globalDiscount > 0) ||
              (target.type === "item" &&
                (items.find((i) => i.id === target.id)?.discount ?? 0) > 0)) && (
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 cursor-pointer"
                onClick={() => {
                  if (target.type === "global") {
                    applyGlobalDiscount(0);
                  } else if (target.id) {
                    applyItemDiscount(target.id, 0);
                  }
                  toast({ title: "Desconto Removido", duration: 2000 });
                  onOpenChange(false);
                }}
              >
                Remover
              </Button>
            )}
            <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={confirmDiscount}>
              Aplicar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
