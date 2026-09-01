import { Tag, Ticket, Trash2 } from "lucide-react";
import { Button, useToast } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { usePdvStore } from "@/stores/use-pdv-store";

type PdvCartTotalsProps = {
  /** Soma dos itens já com os descontos de linha. */
  subtotal: number;
  /** Subtotal menos o desconto da venda. É o que o checkout cobra. */
  total: number;
};

/**
 * A conta da venda: subtotal, os abatimentos aplicados e o total final.
 *
 * Vive fora do painel porque os dois layouts do resumo (estendido e compacto)
 * mostram a MESMA conta — o que muda entre eles é só onde ficam os botões. Com a
 * conta duplicada nos dois, uma linha nova de abatimento entraria em um e
 * faltaria no outro, e o operador leria totais diferentes conforme a
 * preferência do terminal.
 *
 * Lê o store direto em vez de receber tudo por prop: remover um desconto é
 * assunto desta caixa, e passar os removedores de fora só faria o painel
 * renderizar junto.
 */
export function PdvCartTotals({ subtotal, total }: PdvCartTotalsProps) {
  const { toast } = useToast();

  const globalDiscount = usePdvStore((state) => state.globalDiscount);
  const applyGlobalDiscount = usePdvStore((state) => state.applyGlobalDiscount);

  const coupon = usePdvStore((state) => state.coupon);
  // Derivado do carrinho a cada render, nunca guardado: bipar um item reajusta o
  // abatimento sozinho, e é este número que vai ao payload e ao comprovante.
  const couponDiscount = usePdvStore((state) => state.getCouponDiscount());
  const removeCoupon = usePdvStore((state) => state.removeCoupon);

  return (
    <>
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

        {/* Linha própria, abaixo do desconto e acima do total: é a ordem em que
            a conta acontece (item → global → cupom) e a mesma do comprovante
            impresso. O cupom aparece mesmo abatendo zero — ele foi apresentado
            no balcão, e sumir da tela faria o operador aplicá-lo de novo. */}
        {coupon && (
          <div className="flex justify-between items-center text-emerald-500 font-bold text-sm">
            <span className="flex items-center gap-1 min-w-0">
              <Ticket className="w-3 h-3 shrink-0" />
              <span className="truncate">CUPOM {coupon.code}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono">- {formatCurrency(couponDiscount)}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-emerald-500 hover:text-destructive hover:bg-destructive/10 p-0 rounded cursor-pointer"
                onClick={() => {
                  removeCoupon();
                  toast({
                    title: "Cupom Removido",
                    description: `O cupom ${coupon.code} saiu desta venda.`,
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

      <div className="pt-2 border-t border-border/50">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-0.5">
          Total Final
        </p>
        {/* Dois degraus menor que o original: continua legível de pé, a um
            metro da tela, e devolve altura para a lista de itens — que é o que
            falta quando o operador põe a fonte em 120% e o nome do produto
            ocupa duas linhas. */}
        <p className="text-3xl font-mono font-bold text-foreground tracking-tight">{formatCurrency(total)}</p>
      </div>
    </>
  );
}
