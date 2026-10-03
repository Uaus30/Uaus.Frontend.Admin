/**
 * Medidas das três peças do catálogo de divulgação, em pixels.
 *
 * As do cabeçalho são as MESMAS de `Artes/catalogo/gerador/gerar_fundos.py`,
 * que recorta o logotipo da arte nessas posições. Mudou aqui, mude lá e gere as
 * artes de novo — senão o título passa por cima do logotipo.
 */

/** Onde o título do tema é escrito, por cima da arte do cabeçalho. */
export interface TitleBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Centralizado embaixo do logotipo (banner) ou à esquerda, ao lado dele (página). */
  align: "center" | "start";
  /** Fator sobre o corpo de `titleFontSize`, calculado para 1000 px de largura. */
  fontScale: number;
}

export interface PieceSpec {
  width: number;
  height: number;
  /** Altura da arte do cabeçalho. Ela continua 40 px por baixo do painel. */
  headerArtHeight: number;
  title: TitleBox;
  /** Onde o painel dos produtos começa. */
  panelTop: number;
  footerHeight: number;
  /** A arte do rodapé sobe por baixo do canto arredondado do painel. */
  footerArtHeight: number;
  panelRadius: number;
  panelPaddingX: number;
  panelPaddingY: number;
  gap: number;
  /** O máximo de produtos que a peça (ou a página) comporta. */
  maxProducts: number;
  /** Colunas conforme a quantidade de produtos. */
  columns: (count: number) => number;
  /**
   * Linhas FIXAS. Ausente, a grade tem as linhas que a quantidade pedir e fica
   * centralizada no painel. Com valor (a página do PDF), o card tem sempre o
   * mesmo tamanho e a grade encosta em cima: a última página, com menos
   * produtos, não pode sair com cards maiores que as outras.
   */
  rows?: number;
  /** O card nunca passa disto vezes a própria largura. */
  maxCardRatio: number;
  /** Teto do fator da tipografia do card. */
  maxScale: number;
  /**
   * Sombra esfumada do painel e dos cards. Custa caro no desenho (é um
   * desfoque por elemento), então a página do PDF, que são várias, não usa.
   */
  softShadows: boolean;
}

/** Até 4 produtos, 2 colunas; acima disso, 3. */
const bannerColumns = (count: number): number => (count <= 4 ? 2 : 3);

/** Banner 9:16 — status do WhatsApp e story do Instagram. */
export const STORY: PieceSpec = {
  width: 1080,
  height: 1920,
  headerArtHeight: 480,
  // Logotipo de 600 px com o topo em 56: termina em 276. O título ocupa daí até o painel.
  title: { left: 40, top: 276, width: 1000, height: 164, align: "center", fontScale: 1 },
  panelTop: 440,
  footerHeight: 210,
  footerArtHeight: 240,
  panelRadius: 40,
  panelPaddingX: 32,
  panelPaddingY: 30,
  gap: 20,
  maxProducts: 9,
  columns: bannerColumns,
  maxCardRatio: 1.35,
  maxScale: 1.4,
  softShadows: true,
};

/** Banner 4:5 — imagem para o grupo de WhatsApp e para o feed. */
export const FEED: PieceSpec = {
  ...STORY,
  height: 1350,
  headerArtHeight: 370,
  // Logotipo de 480 px com o topo em 40: termina em 216.
  title: { left: 40, top: 216, width: 1000, height: 114, align: "center", fontScale: 0.9 },
  panelTop: 330,
  footerHeight: 190,
  maxProducts: 6,
  // O painel aqui é baixo: com 3 ou 4 produtos em 2 colunas seriam 2 linhas de
  // card largo e achatado, e o texto (que cresce com a largura) deixaria a foto
  // com menos da metade do card. Duas colunas só quando a linha é uma só.
  columns: (count) => (count <= 2 ? 2 : 3),
};

/**
 * Página do catálogo em PDF: 1080 × 2340 (9:19,5, a proporção da tela dos
 * celulares de hoje), com cabeçalho compacto e 6 cards grandes em 2 colunas.
 */
export const PAGE: PieceSpec = {
  ...STORY,
  height: 2340,
  headerArtHeight: 270,
  // Logotipo de 360 px encostado à esquerda (48 a 408); o título vai ao lado.
  title: { left: 440, top: 34, width: 600, height: 162, align: "start", fontScale: 0.6 },
  panelTop: 230,
  footerHeight: 180,
  maxProducts: 6,
  columns: () => 2,
  rows: 3,
  maxCardRatio: 1.3,
  maxScale: 1.35,
  softShadows: false,
};

/**
 * As peças pelo nome. O desenho roda num worker, e a medida tem uma função
 * (`columns`) que não atravessa `postMessage`: o que viaja é o nome, e cada
 * lado busca a medida aqui.
 */
export const PIECE_SPECS = { story: STORY, feed: FEED, page: PAGE } as const;

export type PieceKind = keyof typeof PIECE_SPECS;

/** Largura do card na grade cheia do banner (3 colunas) — a régua da tipografia. */
const BASE_CARD_WIDTH = 325;

/** Bloco de texto do card (nome em duas linhas e preço), na escala 1. */
const BASE_INFO_HEIGHT = 150;

export interface PieceGrid {
  columns: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  /** Altura reservada à foto dentro do card. */
  photoHeight: number;
  /**
   * Fator da tipografia do card. Com poucos produtos o card cresce, e o texto
   * cresce junto — senão sobra um nome miúdo embaixo de uma foto enorme.
   */
  scale: number;
}

/**
 * A grade do painel para `count` produtos numa peça.
 *
 * O card nunca passa de `maxCardRatio` da própria largura: com uma linha só,
 * esticá-lo até o painel inteiro daria um card de mais de mil pixels de altura
 * com a foto perdida no meio.
 */
export function pieceGrid(spec: PieceSpec, count: number): PieceGrid {
  const total = Math.min(Math.max(count, 1), spec.maxProducts);
  const columns = spec.columns(total);
  const rows = spec.rows ?? Math.ceil(total / columns);

  const innerWidth = spec.width - 2 * spec.panelPaddingX;
  const panelHeight = spec.height - spec.panelTop - spec.footerHeight;
  const innerHeight = panelHeight - 2 * spec.panelPaddingY;

  const cardWidth = Math.floor((innerWidth - spec.gap * (columns - 1)) / columns);
  const tallest = Math.floor((innerHeight - spec.gap * (rows - 1)) / rows);
  const cardHeight = Math.min(tallest, Math.round(cardWidth * spec.maxCardRatio));

  const scale = Math.min(cardWidth / BASE_CARD_WIDTH, spec.maxScale);
  const photoHeight = cardHeight - Math.round(BASE_INFO_HEIGHT * scale);

  return { columns, rows, cardWidth, cardHeight, photoHeight, scale };
}

/** Um card na peça, em pixels, com a origem no canto de cima à esquerda. */
export interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Onde cada card foi desenhado, na ordem dos produtos. É a área clicável de
 * cada produto no PDF — e por isso repete a conta do molde (`CatalogPiece`):
 * grade centralizada no painel, ou encostada em cima e à esquerda quando as
 * linhas são fixas. Mudou o alinhamento lá, mude aqui: o link sairia deslocado
 * do card sem nenhum erro.
 */
export function cardRects(spec: PieceSpec, count: number): CardRect[] {
  const total = Math.min(Math.max(count, 0), spec.maxProducts);
  if (total === 0) return [];

  const grid = pieceGrid(spec, total);
  const innerWidth = spec.width - 2 * spec.panelPaddingX;
  const innerHeight = spec.height - spec.panelTop - spec.footerHeight - 2 * spec.panelPaddingY;

  const usedRows = Math.ceil(total / grid.columns);
  const gridHeight = usedRows * grid.cardHeight + (usedRows - 1) * spec.gap;
  const top = spec.panelTop + spec.panelPaddingY + (spec.rows ? 0 : (innerHeight - gridHeight) / 2);

  return Array.from({ length: total }, (_, index) => {
    const row = Math.floor(index / grid.columns);
    const column = index % grid.columns;
    const inRow = Math.min(grid.columns, total - row * grid.columns);
    const rowWidth = inRow * grid.cardWidth + (inRow - 1) * spec.gap;
    const left = spec.panelPaddingX + (spec.rows ? 0 : (innerWidth - rowWidth) / 2);

    return {
      x: Math.round(left + column * (grid.cardWidth + spec.gap)),
      y: Math.round(top + row * (grid.cardHeight + spec.gap)),
      width: grid.cardWidth,
      height: grid.cardHeight,
    };
  });
}

/** Parte a lista em linhas de `columns` itens, na ordem recebida. */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}
