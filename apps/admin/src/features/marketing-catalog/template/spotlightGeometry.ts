import type { SpotlightFormat } from "../types";
import { FEED, STORY, type FrameSpec } from "./geometry";

/**
 * Medidas do banner de destaque (04/11/2026): um produto só, no painel inteiro.
 *
 * A moldura (cabeçalho, título, painel e rodapé) é a MESMA dos banners do
 * catálogo — as artes já estão recortadas nessas posições, e o banner de
 * destaque não pede arte nova. O que muda é o que vai dentro do painel.
 */
export interface SpotlightSpec extends FrameSpec {
  /**
   * 9:16: foto em cima, nome e preço embaixo. 4:5: foto à esquerda e texto à
   * direita — o painel desse formato é baixo, e com a foto em cima sobraria
   * pouco para o nome e o preço.
   */
  layout: "stacked" | "sideBySide";
  /** Folga entre a borda do painel e o card. */
  panelPadding: number;
  /** Folga entre a borda do card e a área da foto. */
  photoMargin: number;
  /** A faixa do texto: a altura dela no 9:16, a largura no 4:5. */
  textSize: number;
  /** Fator da tipografia sobre as medidas do card do catálogo na escala 1. */
  textScale: number;
  badgeScale: number;
  /** Linhas do nome antes das reticências. */
  nameLines: number;
}

/** Só a moldura de uma peça do catálogo — o resto das medidas é da grade. */
function frameOf(spec: FrameSpec): FrameSpec {
  return {
    width: spec.width,
    height: spec.height,
    headerArtHeight: spec.headerArtHeight,
    title: spec.title,
    panelTop: spec.panelTop,
    footerHeight: spec.footerHeight,
    footerArtHeight: spec.footerArtHeight,
    panelRadius: spec.panelRadius,
    softShadows: spec.softShadows,
  };
}

/** Banner 9:16 — status do WhatsApp e story do Instagram. */
export const SPOTLIGHT_STORY: SpotlightSpec = {
  ...frameOf(STORY),
  layout: "stacked",
  panelPadding: 40,
  photoMargin: 30,
  // Nome em três linhas, "de", preço e duas linhas miúdas (validade e limite).
  textSize: 470,
  textScale: 2.3,
  badgeScale: 2.6,
  nameLines: 3,
};

/** Banner 4:5 — imagem para o grupo de WhatsApp e para o feed. */
export const SPOTLIGHT_FEED: SpotlightSpec = {
  ...frameOf(FEED),
  layout: "sideBySide",
  panelPadding: 32,
  photoMargin: 30,
  // A coluna do texto. "R$ 29,90" no corpo cheio ocupa cerca de 270 px.
  textSize: 420,
  textScale: 1.9,
  badgeScale: 2.2,
  nameLines: 4,
};

/** As medidas pelo nome: o worker recebe o nome, e cada lado busca a medida aqui. */
export const SPOTLIGHT_SPECS: Record<SpotlightFormat, SpotlightSpec> = {
  story: SPOTLIGHT_STORY,
  feed: SPOTLIGHT_FEED,
};

interface Box {
  width: number;
  height: number;
}

/** O card, a área da foto e a faixa do texto dentro do painel. */
export interface SpotlightBoxes {
  card: Box;
  photo: Box;
  text: Box;
}

export function spotlightBoxes(spec: SpotlightSpec): SpotlightBoxes {
  const card = {
    width: spec.width - 2 * spec.panelPadding,
    height: spec.height - spec.panelTop - spec.footerHeight - 2 * spec.panelPadding,
  };
  const margin = spec.photoMargin;

  if (spec.layout === "stacked") {
    return {
      card,
      photo: { width: card.width - 2 * margin, height: card.height - margin - spec.textSize },
      text: { width: card.width, height: spec.textSize },
    };
  }

  return {
    card,
    photo: { width: card.width - margin - spec.textSize, height: card.height - 2 * margin },
    text: { width: spec.textSize, height: card.height },
  };
}

/**
 * O quanto a foto pode crescer além do tamanho que ela tem no arquivo
 * (decisão do dono, 04/11/2026: foto pequena só avisa, não impede). Cerca de 39%
 * das capas têm menos de 300 px no menor lado; esticada a 900 px, uma de 225 px
 * borra. Com o teto ela sai menor, centrada no card branco, e nítida.
 */
export const MAX_PHOTO_UPSCALE = 2;

/**
 * O tamanho em que a foto é desenhada: cabe na área, mantém a proporção e não
 * passa de {@link MAX_PHOTO_UPSCALE} vezes o original. Tamanho desconhecido
 * (zero) ocupa a área inteira, como a foto do catálogo.
 */
export function fitPhoto(box: Box, natural: Box): Box {
  if (natural.width <= 0 || natural.height <= 0) return box;

  const ratio = Math.min(box.width / natural.width, box.height / natural.height, MAX_PHOTO_UPSCALE);
  return {
    width: Math.max(1, Math.round(natural.width * ratio)),
    height: Math.max(1, Math.round(natural.height * ratio)),
  };
}
