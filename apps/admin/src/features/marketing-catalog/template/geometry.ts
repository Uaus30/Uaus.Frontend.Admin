/**
 * Medidas do banner 9:16 (status do WhatsApp e story do Instagram), em pixels.
 *
 * As do cabeçalho são as MESMAS de `Artes/catalogo/gerador/gerar_fundos.py`,
 * que recorta o logotipo da arte nessas posições. Mudou aqui, mude lá e gere as
 * artes de novo — senão o título passa por cima do logotipo.
 */
export const STORY = {
  width: 1080,
  height: 1920,
  /** Altura da arte do cabeçalho. Ela continua 40 px por baixo do painel. */
  headerArtHeight: 480,
  /** Onde o logotipo termina dentro da arte (topo 56 + 220 de altura). */
  logoBottom: 276,
  /** Onde o painel dos produtos começa. Entre os dois fica o título. */
  panelTop: 440,
  footerHeight: 210,
  /** A arte do rodapé sobe 30 px por baixo do canto arredondado do painel. */
  footerArtHeight: 240,
  panelRadius: 40,
  panelPaddingX: 32,
  panelPaddingY: 30,
  gap: 20,
} as const;

/** O máximo de produtos que o banner comporta sem a foto virar selo. */
export const STORY_MAX_PRODUCTS = 9;

/** Largura do card na grade cheia (3 colunas) — a régua da tipografia. */
const BASE_CARD_WIDTH = 325;

/** Bloco de texto do card (nome em duas linhas e preço), na escala 1. */
const BASE_INFO_HEIGHT = 150;

export interface StoryGrid {
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
 * A grade do painel para `count` produtos.
 *
 * Até 4 produtos são 2 colunas; acima disso, 3. O card nunca passa de 1,35 da
 * própria largura: com uma linha só, esticá-lo até o painel inteiro daria um
 * card de mais de mil pixels de altura com a foto perdida no meio.
 */
export function storyGrid(count: number): StoryGrid {
  const total = Math.min(Math.max(count, 1), STORY_MAX_PRODUCTS);
  const columns = total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / columns);

  const innerWidth = STORY.width - 2 * STORY.panelPaddingX;
  const panelHeight = STORY.height - STORY.panelTop - STORY.footerHeight;
  const innerHeight = panelHeight - 2 * STORY.panelPaddingY;

  const cardWidth = Math.floor((innerWidth - STORY.gap * (columns - 1)) / columns);
  const tallest = Math.floor((innerHeight - STORY.gap * (rows - 1)) / rows);
  const cardHeight = Math.min(tallest, Math.round(cardWidth * 1.35));

  const scale = Math.min(cardWidth / BASE_CARD_WIDTH, 1.4);
  const photoHeight = cardHeight - Math.round(BASE_INFO_HEIGHT * scale);

  return { columns, rows, cardWidth, cardHeight, photoHeight, scale };
}

/** Parte a lista em linhas de `columns` itens, na ordem recebida. */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}
