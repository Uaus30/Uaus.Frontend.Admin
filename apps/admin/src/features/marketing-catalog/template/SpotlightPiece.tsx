import type { CatalogBadge, SpotlightData, SpotlightKind } from "../types";
import { CATALOG_COLORS } from "./palette";
import { PieceFrame } from "./PieceFrame";
import { PriceCaption, PriceFigure } from "./Price";
import { Badge } from "./ProductCard";
import { fitPhoto, spotlightBoxes, type SpotlightSpec } from "./spotlightGeometry";
import { priceDigitsFactor } from "./text";

/** O selo de cada tipo: as cores e as palavras do catálogo, e o "REPOSIÇÃO" do dono. */
const BADGE_OF_KIND: Record<SpotlightKind, CatalogBadge> = {
  offer: "offer",
  new: "new",
  restock: "restock",
};

/**
 * O molde do banner de destaque (04/11/2026): UM produto no painel inteiro,
 * com o selo do motivo — promoção, novidade ou reposição.
 *
 * A moldura é a do catálogo (`PieceFrame`), e o preço também (`Price`): o "de"
 * riscado e o "a partir de" seguem a mesma regra do card. O selo é sempre o do
 * TIPO escolhido; no combo, o promocional diz a oferta ("3 POR R$ 20,00").
 *
 * Desenhado pelo satori (ver `ProductCard.tsx`): flexbox, estilo inline, todo
 * `div` com mais de um filho em `display: flex`, e nenhuma chave com `undefined`.
 */
export function SpotlightPiece({
  spec,
  kind,
  title,
  card,
  photoSize,
  notes,
  store,
  date,
  art,
}: SpotlightData & { spec: SpotlightSpec }) {
  const boxes = spotlightBoxes(spec);
  const photo = fitPhoto(boxes.photo, photoSize);
  const stacked = spec.layout === "stacked";
  const align = stacked ? "center" : "flex-start";
  const scale = spec.textScale;
  const margin = spec.photoMargin;

  return (
    <PieceFrame
      spec={spec}
      title={title}
      store={store}
      date={date}
      art={art}
      panelStyle={{ alignItems: "center", justifyContent: "center", padding: spec.panelPadding }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          width: boxes.card.width,
          height: boxes.card.height,
          backgroundColor: CATALOG_COLORS.card,
          borderRadius: 36,
          // A chave só existe com sombra: o satori recusa `boxShadow: undefined`.
          ...(spec.softShadows
            ? { boxShadow: "0 10px 28px rgba(133, 62, 14, 0.18)" }
            : { border: "2px solid #F2D9C4" }),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: boxes.photo.width,
            height: boxes.photo.height,
            margin: stacked ? `${margin}px ${margin}px 0` : `${margin}px 0 ${margin}px ${margin}px`,
          }}
        >
          <img src={card.photo} width={photo.width} height={photo.height} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: align,
            justifyContent: "center",
            width: boxes.text.width,
            height: boxes.text.height,
            padding: stacked
              ? `0 ${margin}px ${margin}px`
              : `${margin}px ${margin}px ${margin}px ${margin + 4}px`,
          }}
        >
          {/* O bloco de fora alinha; o de dentro corta em linhas. Num bloco só, o
              satori alinha à esquerda o nome que cabe em uma linha. */}
          <div style={{ display: "flex", justifyContent: align, width: "100%" }}>
            <div
              style={{
                display: "block",
                lineClamp: spec.nameLines,
                fontSize: Math.round(20 * scale),
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: stacked ? "center" : "left",
                color: CATALOG_COLORS.ink,
              }}
            >
              {card.name}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: align,
              marginTop: Math.round(10 * scale),
            }}
          >
            <PriceCaption card={card} scale={scale} />
            <PriceFigure price={card.price} scale={scale * priceDigitsFactor(card.price)} />
          </div>

          {notes.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: align,
                marginTop: Math.round(8 * scale),
                fontSize: Math.round(13 * scale),
                fontWeight: 700,
                lineHeight: 1.3,
                color: CATALOG_COLORS.promo,
              }}
            >
              {notes.map((note) => (
                <div key={note} style={{ display: "flex" }}>
                  {note}
                </div>
              ))}
            </div>
          )}
        </div>

        <Badge
          badge={BADGE_OF_KIND[kind]}
          scale={spec.badgeScale}
          text={kind === "offer" ? card.comboOffer : undefined}
        />
      </div>
    </PieceFrame>
  );
}
