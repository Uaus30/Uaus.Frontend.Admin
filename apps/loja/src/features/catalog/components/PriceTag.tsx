import { formatCurrency } from "@workspace/core";

interface PriceTagProps {
  price: number;
  priceMax?: number | null;
  /** `lg` no detalhe, `md` no card. */
  size?: "md" | "lg";
}

/**
 * Preço no padrão visual do site original ("Por apenas R$ X,XX").
 *
 * Grupo com variações de preços diferentes vira "A partir de": mostrar um
 * preço único mentiria para metade das variações, e faixa completa
 * ("R$ 15 – R$ 30") polui o card — o detalhe lista cada variação com o seu.
 */
export function PriceTag({ price, priceMax, size = "md" }: PriceTagProps) {
  const hasRange = priceMax != null && priceMax > price;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {hasRange ? "A partir de" : "Por apenas"}
      </p>
      <p
        className={
          size === "lg"
            ? "font-display text-4xl font-extrabold text-primary-strong"
            : "font-display text-xl font-extrabold text-primary-strong"
        }
      >
        {formatCurrency(price)}
      </p>
    </div>
  );
}
