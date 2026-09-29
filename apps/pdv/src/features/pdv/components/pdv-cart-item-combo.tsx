import { Layers } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import { PROMOTION_DISCOUNT_TYPE } from "@workspace/api-client-react";
import { describeComboOffer } from "@/lib/combo-promotions";
import type { PromotionComboInfo } from "@/lib/promotions";

type PdvCartItemComboChipProps = {
  combo: PromotionComboInfo;
  /** Unidades desta linha que entraram no combo. */
  promotionalQuantity: number;
  /** Unidades desta linha que sobraram do kit, a preço normal. */
  regularQuantity: number;
};

/**
 * O selo do combo na linha do carrinho.
 *
 * Aparece **antes** de o kit fechar, e é o ponto dele: o cliente que pegou dois
 * esmaltes de um "3 por R$ 20" ouve do operador "leve mais um". Por isso a frase
 * diz o que falta, e não só o que já valeu.
 *
 * O desconto é o da LINHA, e não por unidade: no kit o centavo não se divide igual
 * (R$ 6,67, R$ 6,67 e R$ 6,66), e "− R$ 0,33 por unidade" seria uma frase que o
 * cupom desmente.
 *
 * Cores do vocabulário da casa (`Uaus.Docs/dominio/convencoes-de-interface.md`):
 * verde quando a linha inteira entrou no combo, âmbar quando é parcial — sobrou
 * unidade fora do kit, ou o combo ainda não vale.
 */
export function PdvCartItemComboChip({
  combo,
  promotionalQuantity,
  regularQuantity,
}: PdvCartItemComboChipProps) {
  const completo = promotionalQuantity > 0 && regularQuantity === 0;
  const kit = combo.discountType === PROMOTION_DISCOUNT_TYPE.KitPrice;

  const tom = completo
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";

  const falta =
    combo.missing > 0
      ? `falta${combo.missing > 1 ? "m" : ""} ${combo.missing} para ${
          !kit ? "o combo valer" : promotionalQuantity > 0 ? "outro kit" : "fechar o kit"
        }`
      : null;

  return (
    <div className={`mt-2 flex items-center gap-2 rounded-md border px-2 py-1 ${tom}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <Layers className="h-3 w-3 shrink-0" />
        <span className="shrink-0 text-[10px] font-bold uppercase">Combo</span>
        <span className="text-[10px] font-semibold">{describeComboOffer(combo)}</span>

        {combo.lineDiscount > 0 && (
          <span className="text-[10px] font-semibold">
            · − {formatCurrency(combo.lineDiscount)} nesta linha
          </span>
        )}

        {falta && <span className="min-w-0 text-[10px] text-muted-foreground">· {falta}</span>}
      </div>
    </div>
  );
}
