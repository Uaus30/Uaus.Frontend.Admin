import { useState, useEffect } from "react";
import { Tag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@workspace/ui";
import { Button, Input, Label } from "@workspace/ui";
import { parseAmount } from "@/lib/checkout";
import { useToast } from "@/hooks/use-toast";
import type { PdvItem } from "@/stores/use-pdv-store";

/** Arredonda para duas casas evitando o erro de ponto flutuante do JavaScript. */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      if (target.type === "global") {
        setDiscountType("value");
        if (globalDiscount > 0) {
          setDiscountValue(globalDiscount.toString());
        } else {
          setDiscountValue("");
        }
      } else if (target.id) {
        const item = items.find((i) => i.id === target.id);
        setDiscountType("value");
        if (item && item.discount && item.discount > 0) {
          setDiscountValue(item.discount.toString());
        } else {
          setDiscountValue("");
        }
      } else {
        setDiscountValue("");
      }
    }
  }, [open, target, globalDiscount, items]);

  const confirmDiscount = () => {
    const val = parseAmount(discountValue);
    if (isNaN(val)) return;

    if (val < 0) {
      toast({
        title: "Desconto Inválido",
        description: "O desconto não pode ser negativo.",
        variant: "destructive",
      });
      return;
    }

    if (target.type === "global") {
      const finalValue = discountType === "percent" ? (subtotal * val) / 100 : val;
      if (finalValue > subtotal) {
        toast({
          title: "Desconto Inválido",
          description: "O desconto não pode ser maior que o subtotal da venda.",
          variant: "destructive",
        });
        return;
      }
      applyGlobalDiscount(round2(finalValue));
    } else if (target.id) {
      const item = items.find((i) => i.id === target.id);
      if (item) {
        const finalValue = discountType === "percent" ? (item.price * val) / 100 : val;
        if (finalValue > item.price) {
          toast({
            title: "Desconto Inválido",
            description: "O desconto não pode ser maior que o valor do item.",
            variant: "destructive",
          });
          return;
        }
        applyItemDiscount(item.id, round2(finalValue));
      }
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
