import type { PieceData } from "../types";
import { chunkRows, pieceGrid, type PieceSpec } from "./geometry";
import { CATALOG_COLORS, CATALOG_FONT_FAMILY } from "./palette";
import { ProductCard } from "./ProductCard";
import { normalizeTitle, priceDisclaimer, titleFontSize } from "./text";

/**
 * O molde das três peças: o banner 9:16, o banner 4:5 e a página do catálogo
 * em PDF. O que muda entre elas são as medidas (`PieceSpec`), não o desenho.
 *
 * De cima para baixo: a arte da marca com o título do tema, o painel creme com
 * os cards, e o rodapé com o contato e o aviso de preços. As duas artes ficam
 * POR BAIXO do painel, que cobre a emenda delas com os cantos arredondados.
 *
 * Desenhado pelo satori (ver `ProductCard.tsx`): flexbox, estilo inline, e
 * posição absoluta para as camadas.
 */
export function CatalogPiece({
  spec,
  title,
  caption,
  cards,
  store,
  date,
  art,
}: PieceData & { spec: PieceSpec }) {
  const visible = cards.slice(0, spec.maxProducts);
  const grid = pieceGrid(spec, visible.length);
  const rows = chunkRows(visible, grid.columns);
  const heading = normalizeTitle(title);
  const centered = spec.title.align === "center";

  const panelHeight = spec.height - spec.panelTop - spec.footerHeight;
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
        width: spec.width,
        height: spec.height,
        backgroundColor: CATALOG_COLORS.orange,
        fontFamily: CATALOG_FONT_FAMILY,
      }}
    >
      <img
        src={art.header}
        width={spec.width}
        height={spec.headerArtHeight}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      <img
        src={art.footer}
        width={spec.width}
        height={spec.footerArtHeight}
        style={{ position: "absolute", top: spec.height - spec.footerArtHeight, left: 0 }}
      />

      <div
        style={{
          position: "absolute",
          top: spec.title.top,
          left: spec.title.left,
          display: "flex",
          flexDirection: "column",
          alignItems: centered ? "center" : "flex-start",
          justifyContent: "center",
          width: spec.title.width,
          height: spec.title.height,
          color: CATALOG_COLORS.white,
          // O mesmo relevo suave do logotipo da arte.
          textShadow: "0 4px 10px rgba(150, 45, 0, 0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: Math.round(titleFontSize(heading) * spec.title.fontScale),
            fontWeight: 900,
            letterSpacing: 1,
            textTransform: "uppercase",
            textAlign: centered ? "center" : "left",
          }}
        >
          {heading}
        </div>
        {caption && (
          <div style={{ display: "flex", marginTop: 8, fontSize: 24, fontWeight: 700 }}>{caption}</div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: spec.panelTop,
          left: 0,
          display: "flex",
          flexDirection: "column",
          // Com linhas fixas (a página do PDF) a grade encosta em cima: a última
          // página, com menos produtos, não fica com os cards boiando no meio.
          justifyContent: spec.rows ? "flex-start" : "center",
          gap: spec.gap,
          width: spec.width,
          height: panelHeight,
          padding: `${spec.panelPaddingY}px ${spec.panelPaddingX}px`,
          backgroundColor: CATALOG_COLORS.panel,
          borderRadius: spec.panelRadius,
          // Sem sombra a chave NÃO pode existir: o satori recusa `boxShadow: undefined`.
          ...(spec.softShadows ? { boxShadow: "0 -6px 24px rgba(120, 40, 0, 0.28)" } : {}),
        }}
      >
        {rows.map((row) => (
          <div
            key={row[0].productGroupId}
            style={{ display: "flex", justifyContent: spec.rows ? "flex-start" : "center", gap: spec.gap }}
          >
            {row.map((card) => (
              <ProductCard key={card.productGroupId} card={card} grid={grid} softShadow={spec.softShadows} />
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: spec.height - spec.footerHeight,
          left: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: spec.width,
          height: spec.footerHeight,
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
