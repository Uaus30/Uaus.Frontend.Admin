import type { CSSProperties, ReactNode } from "react";
import type { CatalogStoreInfo, PieceArt } from "../types";
import type { FrameSpec } from "./geometry";
import { CATALOG_COLORS, CATALOG_FONT_FAMILY } from "./palette";
import { normalizeTitle, priceDisclaimer, titleFontSize } from "./text";

interface PieceFrameProps {
  spec: FrameSpec;
  title: string;
  /** Linha miúda sob o título — "Página 2 de 4", no catálogo em PDF. */
  caption?: string;
  store: CatalogStoreInfo;
  date: Date;
  art: PieceArt;
  /** O arranjo do painel: coluna de fileiras no catálogo, um card só no destaque. */
  panelStyle: CSSProperties;
  /** O que vai dentro do painel creme. */
  children: ReactNode;
}

/**
 * A moldura de toda peça: a arte da marca com o título, o painel creme e o
 * rodapé com o contato e o aviso de preços. É a MESMA no catálogo e no banner de
 * destaque (04/11/2026): o que muda é o que vai dentro do painel.
 *
 * De cima para baixo, as duas artes ficam POR BAIXO do painel, que cobre a
 * emenda delas com os cantos arredondados. Desenhado pelo satori: flexbox,
 * estilo inline, e posição absoluta para as camadas.
 */
export function PieceFrame({
  spec,
  title,
  caption,
  store,
  date,
  art,
  panelStyle,
  children,
}: PieceFrameProps) {
  const heading = normalizeTitle(title);
  const centered = spec.title.align === "center";
  // Título e legenda ("Página 2 de 4") seguem o mesmo alinhamento.
  const titleAlign = centered ? "center" : "flex-end";

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
          alignItems: titleAlign,
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
            textAlign: centered ? "center" : "right",
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
          width: spec.width,
          height: panelHeight,
          backgroundColor: CATALOG_COLORS.panel,
          borderRadius: spec.panelRadius,
          // Sem sombra a chave NÃO pode existir: o satori recusa `boxShadow: undefined`.
          ...(spec.softShadows ? { boxShadow: "0 -6px 24px rgba(120, 40, 0, 0.28)" } : {}),
          ...panelStyle,
        }}
      >
        {children}
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
