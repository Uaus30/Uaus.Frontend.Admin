import type { StoryBannerData } from "../types";
import { chunkRows, STORY, STORY_MAX_PRODUCTS, storyGrid } from "./geometry";
import { CATALOG_COLORS, CATALOG_FONT_FAMILY } from "./palette";
import { ProductCard } from "./ProductCard";
import { normalizeTitle, priceDisclaimer, titleFontSize } from "./text";

/**
 * O molde do banner 9:16 (status do WhatsApp e story do Instagram).
 *
 * De cima para baixo: a arte da marca com o título do catálogo por baixo do
 * logotipo, o painel creme com os cards, e o rodapé com o contato e o aviso de
 * preços. As duas artes ficam POR BAIXO do painel, que cobre a emenda delas
 * com os cantos arredondados.
 *
 * Desenhado pelo satori (ver `ProductCard.tsx`): flexbox, estilo inline, e
 * posição absoluta para as camadas.
 */
export function StoryBanner({ title, cards, store, date, art }: StoryBannerData) {
  const visible = cards.slice(0, STORY_MAX_PRODUCTS);
  const grid = storyGrid(visible.length);
  const rows = chunkRows(visible, grid.columns);
  const heading = normalizeTitle(title);

  const panelHeight = STORY.height - STORY.panelTop - STORY.footerHeight;
  const footerTop = STORY.height - STORY.footerHeight;
  // Cada bloco do contato só entra quando o dado existe: rodapé com "WhatsApp"
  // seguido de nada é pior do que rodapé sem a linha.
  const contact = [store.whatsapp && `WhatsApp ${store.whatsapp}`, store.site]
    .filter(Boolean)
    .join("   ·   ");

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: STORY.width,
        height: STORY.height,
        backgroundColor: CATALOG_COLORS.orange,
        fontFamily: CATALOG_FONT_FAMILY,
      }}
    >
      <img
        src={art.header}
        width={STORY.width}
        height={STORY.headerArtHeight}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <img
        src={art.footer}
        width={STORY.width}
        height={STORY.footerArtHeight}
        style={{ position: "absolute", top: STORY.height - STORY.footerArtHeight, left: 0 }}
      />

      <div
        style={{
          position: "absolute",
          top: STORY.logoBottom,
          left: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: STORY.width - 80,
          height: STORY.panelTop - STORY.logoBottom,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: titleFontSize(heading),
            fontWeight: 900,
            letterSpacing: 1,
            textTransform: "uppercase",
            textAlign: "center",
            color: CATALOG_COLORS.white,
            // O mesmo relevo suave do logotipo da arte.
            textShadow: "0 4px 10px rgba(150, 45, 0, 0.45)",
          }}
        >
          {heading}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: STORY.panelTop,
          left: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: STORY.gap,
          width: STORY.width,
          height: panelHeight,
          padding: `${STORY.panelPaddingY}px ${STORY.panelPaddingX}px`,
          backgroundColor: CATALOG_COLORS.panel,
          borderRadius: STORY.panelRadius,
          boxShadow: "0 -6px 24px rgba(120, 40, 0, 0.28)",
        }}
      >
        {rows.map((row) => (
          <div
            key={row[0].productGroupId}
            style={{ display: "flex", justifyContent: "center", gap: STORY.gap }}
          >
            {row.map((card) => (
              <ProductCard key={card.productGroupId} card={card} grid={grid} />
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: footerTop,
          left: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: STORY.width,
          height: STORY.footerHeight,
          padding: "0 48px",
          color: CATALOG_COLORS.white,
          textAlign: "center",
        }}
      >
        {store.address && (
          <div style={{ display: "flex", fontSize: 27, fontWeight: 700, lineHeight: 1.25 }}>
            {store.address}
          </div>
        )}
        {contact && (
          <div style={{ display: "flex", fontSize: 29, fontWeight: 800, lineHeight: 1.3 }}>{contact}</div>
        )}
        <div style={{ display: "flex", marginTop: 12, fontSize: 19, fontWeight: 500, lineHeight: 1.3 }}>
          {priceDisclaimer(date)}
        </div>
      </div>
    </div>
  );
}
