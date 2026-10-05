import type { CSSProperties } from "react";
import type { CatalogBadge, CatalogCard } from "../types";
import type { PieceGrid } from "./geometry";
import { CATALOG_COLORS } from "./palette";
import { BADGE_LABEL, formatPrice, splitPrice } from "./text";

/**
 * O card de um produto no molde.
 *
 * **Este arquivo é desenhado pelo satori, não pelo navegador.** Ele entende um
 * subconjunto do CSS: flexbox (sem grid), e todo `div` com mais de um filho
 * precisa de `display: flex`. Estilo só inline — classe do Tailwind não chega
 * ao arquivo gerado. O teste `CatalogPiece.render.test.tsx` passa o molde pelo
 * satori de verdade justamente para pegar o que este subconjunto recusa.
 */

const BADGE_STYLE: Record<CatalogBadge, CSSProperties> = {
  // Vermelho com o raio amarelo (05/10/2026): o preto de antes sumia no meio da
  // peça, e o dono pediu um selo de promoção mais chamativo.
  offer: { backgroundColor: CATALOG_COLORS.promo, color: CATALOG_COLORS.white },
  new: { backgroundColor: CATALOG_COLORS.orange, color: CATALOG_COLORS.white },
  lastUnits: {
    backgroundColor: CATALOG_COLORS.white,
    color: CATALOG_COLORS.orange,
    border: `2px solid ${CATALOG_COLORS.orange}`,
  },
};

/**
 * O selo do card. No combo, o selo de promoção diz a oferta ("3 POR R$ 20,00")
 * no lugar da palavra: o card não tem altura para mais uma linha abaixo do preço
 * (150 px de texto na escala 1, já ocupados por nome, "de" e preço), e o selo é
 * onde o olho procura a promoção.
 */
function Badge({ badge, scale, text }: { badge: CatalogBadge; scale: number; text?: string }) {
  const size = Math.round(15 * scale);
  return (
    <div
      style={{
        position: "absolute",
        top: Math.round(12 * scale),
        left: Math.round(12 * scale),
        display: "flex",
        alignItems: "center",
        padding: `${Math.round(5 * scale)}px ${Math.round(12 * scale)}px`,
        borderRadius: 999,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: 0.5,
        ...BADGE_STYLE[badge],
      }}
    >
      {badge === "offer" && (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: Math.round(5 * scale) }}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={CATALOG_COLORS.promoAccent} />
        </svg>
      )}
      {text ? text.toUpperCase() : BADGE_LABEL[badge]}
    </div>
  );
}

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
function PriceCaption({ card, scale }: { card: CatalogCard; scale: number }) {
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

interface ProductCardProps {
  card: CatalogCard;
  grid: PieceGrid;
  /** Sombra esfumada (banner) ou só uma borda (página do PDF, onde o desfoque pesa). */
  softShadow: boolean;
}

export function ProductCard({ card, grid, softShadow }: ProductCardProps) {
  const { scale } = grid;
  const price = splitPrice(card.price);
  const photoPadding = Math.round(14 * scale);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: grid.cardWidth,
        height: grid.cardHeight,
        backgroundColor: CATALOG_COLORS.card,
        borderRadius: Math.round(24 * scale),
        // Sombra esfumada ou contorno, nunca a chave com `undefined`: o satori
        // recusa `boxShadow: undefined` e quebra ao ler `border: undefined`.
        ...(softShadow
          ? { boxShadow: "0 8px 18px rgba(133, 62, 14, 0.16)" }
          : { border: "2px solid #F2D9C4" }),
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: grid.cardWidth,
          height: grid.photoHeight,
        }}
      >
        <img
          src={card.photo}
          width={grid.cardWidth - 2 * photoPadding}
          height={grid.photoHeight - photoPadding}
          style={{ objectFit: "contain", marginTop: photoPadding }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          flexGrow: 1,
          padding: `${Math.round(8 * scale)}px ${Math.round(14 * scale)}px ${Math.round(12 * scale)}px`,
        }}
      >
        {/* O bloco de fora centraliza; o de dentro corta em duas linhas. Num bloco
            só, o satori alinha à esquerda o nome que cabe em uma linha. */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <div
            style={{
              display: "block",
              lineClamp: 2,
              fontSize: Math.round(20 * scale),
              fontWeight: 600,
              lineHeight: 1.22,
              textAlign: "center",
              color: CATALOG_COLORS.ink,
            }}
          >
            {card.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <PriceCaption card={card} scale={scale} />
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
              {price.whole}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: Math.round(5 * scale),
                fontSize: Math.round(25 * scale),
                fontWeight: 800,
              }}
            >
              {`,${price.cents}`}
            </div>
          </div>
        </div>
      </div>

      {card.badge && (
        <Badge badge={card.badge} scale={scale} text={card.badge === "offer" ? card.comboOffer : undefined} />
      )}
    </div>
  );
}
