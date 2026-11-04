import type { CatalogCard } from "../types";
import { CATALOG_COLORS } from "./palette";
import { formatPrice, splitPrice } from "./text";

/**
 * O preço impresso, igual no card do catálogo e no banner de destaque
 * (04/11/2026). Um lugar só: o "de" riscado e o "a partir de" seguem uma regra
 * do domínio, e duas cópias acabariam discordando sobre o mesmo produto.
 *
 * Desenhado pelo satori (ver `ProductCard.tsx`): flexbox e estilo inline.
 */

/**
 * A linha miúda acima do preço: o "de" riscado da oferta e o "a partir de".
 *
 * **Os dois convivem**, como no site (`PriceTag` da loja). Oferta de 20% num
 * grupo com variações de R$ 10 e R$ 16 custa de R$ 8,00 a R$ 12,80: imprimir só
 * "de R$ 10,00" sobre o R$ 8,00 prometeria o menor preço para todas as
 * variações (achado da revisão de 03/10/2026).
 *
 * Sem legenda a linha continua ocupando a altura: é o que alinha os preços de
 * uma mesma fileira, com e sem oferta.
 */
export function PriceCaption({ card, scale }: { card: CatalogCard; scale: number }) {
  const hasReference = card.referencePrice != null;

  return (
    <div
      style={{
        display: "flex",
        gap: Math.round(5 * scale),
        height: Math.round(22 * scale),
        fontSize: Math.round(17 * scale),
        fontWeight: 600,
        color: CATALOG_COLORS.muted,
      }}
    >
      {hasReference && <div style={{ display: "flex" }}>de</div>}
      {hasReference && (
        <div style={{ display: "flex", textDecoration: "line-through" }}>
          {formatPrice(card.referencePrice!)}
        </div>
      )}
      {card.hasPriceRange && (
        <div style={{ display: "flex" }}>{hasReference ? "· a partir de" : "a partir de"}</div>
      )}
    </div>
  );
}

/** O preço como na etiqueta de mercado: "R$" pequeno, reais grandes, centavos pela metade. */
export function PriceFigure({ price, scale }: { price: number; scale: number }) {
  const parts = splitPrice(price);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", color: CATALOG_COLORS.orange }}>
      <div
        style={{
          display: "flex",
          marginTop: Math.round(7 * scale),
          marginRight: Math.round(5 * scale),
          fontSize: Math.round(22 * scale),
          fontWeight: 800,
        }}
      >
        R$
      </div>
      <div
        style={{
          display: "flex",
          fontSize: Math.round(52 * scale),
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -1,
        }}
      >
        {parts.whole}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: Math.round(5 * scale),
          fontSize: Math.round(25 * scale),
          fontWeight: 800,
        }}
      >
        {`,${parts.cents}`}
      </div>
    </div>
  );
}
