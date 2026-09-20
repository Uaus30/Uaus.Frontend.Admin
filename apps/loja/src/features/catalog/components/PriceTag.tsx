import { formatCurrency } from "@workspace/core";
import type { StorefrontPromotionDto } from "@workspace/api-client-react";

interface PriceTagProps {
  /** Preço de TABELA — continua sendo ele, mesmo com promoção. */
  price: number;
  priceMax?: number | null;
  /** A promoção vigente, quando houver. É ela que manda no que o cliente paga. */
  promotion?: StorefrontPromotionDto | null;
  /** `lg` no detalhe, `md` no card. */
  size?: "md" | "lg";
}

/**
 * Preço no padrão visual do site original ("Por apenas R$ X,XX").
 *
 * Grupo com variações de preços diferentes vira "A partir de": mostrar um
 * preço único mentiria para metade das variações, e faixa completa
 * ("R$ 15 – R$ 30") polui o card — o detalhe lista cada variação com o seu.
 *
 * ## O "de/por"
 *
 * Com promoção vigente, o preço grande é o PROMOCIONAL e o de tabela vai
 * riscado em cima. O "de" só aparece quando o servidor o manda: abaixo de 5% de
 * corte ele nem entra na resposta, porque "de R$ 5,00 por R$ 4,90" é anúncio
 * que não impressiona e desgasta a palavra promoção.
 *
 * O limite por venda vai junto quando existe: é o que a cliente precisa saber
 * ANTES de sair de casa, e é o que o cartaz do WhatsApp já diz.
 */
export function PriceTag({ price, priceMax, promotion, size = "md" }: PriceTagProps) {
  const emPromocao = promotion != null;
  const valor = emPromocao ? promotion.price : price;
  const valorMax = emPromocao ? promotion.priceMax : priceMax;
  const faixa = valorMax != null && valorMax > valor;

  const tamanho =
    size === "lg"
      ? "font-display text-4xl font-black text-primary"
      : "font-display text-xl font-black text-primary";

  return (
    <div>
      {emPromocao && promotion.referencePrice != null && (
        <p className="text-xs text-muted-foreground">
          de <span className="line-through">{formatCurrency(promotion.referencePrice)}</span>
        </p>
      )}

      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {faixa ? "A partir de" : "Por apenas"}
      </p>
      <p className={tamanho}>{formatCurrency(valor)}</p>

      {emPromocao && promotion.maxQuantityPerSale != null && promotion.maxQuantityPerSale > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Limite de {promotion.maxQuantityPerSale} por cliente
        </p>
      )}
    </div>
  );
}
