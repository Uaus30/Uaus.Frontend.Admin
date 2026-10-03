import { describe, expect, it } from "vitest";
import { cardRects, chunkRows, FEED, PAGE, PIECE_SPECS, pieceGrid, STORY, type PieceSpec } from "../geometry";

const innerWidth = (spec: PieceSpec) => spec.width - 2 * spec.panelPaddingX;
const innerHeight = (spec: PieceSpec) =>
  spec.height - spec.panelTop - spec.footerHeight - 2 * spec.panelPaddingY;

/** Todas as quantidades que cada peça aceita. */
const CASES = Object.entries(PIECE_SPECS).flatMap(([name, spec]) =>
  Array.from({ length: spec.maxProducts }, (_, index) => ({ name, spec, count: index + 1 })),
);

describe("pieceGrid — banner 9:16", () => {
  it("o banner cheio são 3 colunas por 3 linhas", () => {
    expect(pieceGrid(STORY, 9)).toMatchObject({ columns: 3, rows: 3, scale: 1 });
  });

  it("até 4 produtos usam 2 colunas, com card e texto maiores", () => {
    const grid = pieceGrid(STORY, 4);

    expect(grid).toMatchObject({ columns: 2, rows: 2 });
    expect(grid.scale).toBeGreaterThan(1);
  });

  it("5 e 6 produtos já são 3 colunas em 2 linhas", () => {
    expect(pieceGrid(STORY, 5)).toMatchObject({ columns: 3, rows: 2 });
    expect(pieceGrid(STORY, 6)).toMatchObject({ columns: 3, rows: 2 });
  });

  it("o card nunca passa de 1,35 da própria largura, nem com uma linha só", () => {
    const grid = pieceGrid(STORY, 2);

    expect(grid.cardHeight).toBeLessThanOrEqual(Math.round(grid.cardWidth * 1.35));
  });

  it("lista vazia e lista acima do teto não quebram a conta", () => {
    expect(pieceGrid(STORY, 0)).toMatchObject({ columns: 2, rows: 1 });
    expect(pieceGrid(STORY, 40)).toEqual(pieceGrid(STORY, STORY.maxProducts));
  });
});

describe("pieceGrid — banner 4:5", () => {
  it("leva 6 produtos em 3 colunas por 2 linhas", () => {
    expect(FEED.maxProducts).toBe(6);
    expect(pieceGrid(FEED, 6)).toMatchObject({ columns: 3, rows: 2 });
  });
});

describe("pieceGrid — página do catálogo em PDF", () => {
  it("são sempre 2 colunas e 3 linhas, com 6 produtos por página", () => {
    expect(PAGE.maxProducts).toBe(6);
    expect(pieceGrid(PAGE, 6)).toMatchObject({ columns: 2, rows: 3 });
  });

  it("a última página, com menos produtos, tem o card do MESMO tamanho das outras", () => {
    const full = pieceGrid(PAGE, 6);

    for (const count of [1, 2, 3, 4, 5]) {
      expect(pieceGrid(PAGE, count)).toEqual(full);
    }
  });

  it("o card é maior que o do banner: é por isso que o PDF pede foto de 300 px", () => {
    expect(pieceGrid(PAGE, 6).cardWidth).toBeGreaterThan(pieceGrid(STORY, 9).cardWidth * 1.4);
  });
});

describe("as três peças", () => {
  it.each(CASES)("$name com $count produto(s): a grade cabe dentro do painel", ({ spec, count }) => {
    const grid = pieceGrid(spec, count);

    expect(grid.columns * grid.cardWidth + (grid.columns - 1) * spec.gap).toBeLessThanOrEqual(
      innerWidth(spec),
    );
    expect(grid.rows * grid.cardHeight + (grid.rows - 1) * spec.gap).toBeLessThanOrEqual(innerHeight(spec));
  });

  it.each(CASES)(
    "$name com $count produto(s): sobra mais da metade do card para a foto",
    ({ spec, count }) => {
      const grid = pieceGrid(spec, count);

      expect(grid.photoHeight).toBeGreaterThan(grid.cardHeight / 2);
    },
  );

  it("o título de cada peça fica dentro da arte do cabeçalho, acima do painel", () => {
    for (const spec of Object.values(PIECE_SPECS)) {
      expect(spec.title.top + spec.title.height).toBeLessThanOrEqual(spec.panelTop);
      expect(spec.title.left + spec.title.width).toBeLessThanOrEqual(spec.width);
      // A arte continua por baixo do canto arredondado do painel.
      expect(spec.headerArtHeight).toBeGreaterThanOrEqual(spec.panelTop + spec.panelRadius);
    }
  });
});

describe("cardRects — a área clicável de cada produto no PDF", () => {
  it("página cheia: 6 áreas, da esquerda para a direita e de cima para baixo", () => {
    const rects = cardRects(PAGE, 6);

    expect(rects).toHaveLength(6);
    expect(rects[0]).toEqual({ x: 32, y: 260, width: 498, height: 610 });
    expect(rects[1]).toEqual({ x: 550, y: 260, width: 498, height: 610 });
    expect(rects[2]).toEqual({ x: 32, y: 890, width: 498, height: 610 });
    expect(rects[5]).toEqual({ x: 550, y: 1520, width: 498, height: 610 });
  });

  it("página incompleta: os cards ficam onde estariam na página cheia", () => {
    // O molde encosta a grade em cima e à esquerda quando as linhas são fixas;
    // se a conta centralizasse, o link do 3º produto cairia no meio da página.
    expect(cardRects(PAGE, 3)).toEqual(cardRects(PAGE, 6).slice(0, 3));
  });

  it("no banner a grade é centralizada, e a linha incompleta também", () => {
    const rects = cardRects(STORY, 7);
    const grid = pieceGrid(STORY, 7);

    // A 3ª linha tem um card só, no meio da largura.
    expect(rects[6].x).toBe(Math.round((STORY.width - grid.cardWidth) / 2));

    // E a grade inteira está centralizada na altura do painel.
    const top = rects[0].y - (STORY.panelTop + STORY.panelPaddingY);
    const bottom = STORY.height - STORY.footerHeight - STORY.panelPaddingY - (rects[6].y + rects[6].height);
    expect(Math.abs(top - bottom)).toBeLessThanOrEqual(1);
  });

  it.each(CASES)(
    "$name com $count produto(s): nenhuma área sai do painel nem encosta em outra",
    ({ spec, count }) => {
      const rects = cardRects(spec, count);

      expect(rects).toHaveLength(count);
      rects.forEach((rect, index) => {
        expect(rect.x).toBeGreaterThanOrEqual(spec.panelPaddingX);
        expect(rect.x + rect.width).toBeLessThanOrEqual(spec.width - spec.panelPaddingX);
        expect(rect.y).toBeGreaterThanOrEqual(spec.panelTop + spec.panelPaddingY);
        expect(rect.y + rect.height).toBeLessThanOrEqual(
          spec.height - spec.footerHeight - spec.panelPaddingY,
        );

        for (const other of rects.slice(index + 1)) {
          const apart =
            rect.x + rect.width <= other.x ||
            other.x + other.width <= rect.x ||
            rect.y + rect.height <= other.y ||
            other.y + other.height <= rect.y;
          expect(apart).toBe(true);
        }
      });
    },
  );

  it("sem produto não há área, e acima do teto valem só os que cabem", () => {
    expect(cardRects(PAGE, 0)).toEqual([]);
    expect(cardRects(PAGE, 10)).toHaveLength(6);
  });
});

describe("chunkRows", () => {
  it("parte na ordem recebida, e a última linha pode vir incompleta", () => {
    expect(chunkRows([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("lista vazia não gera linha", () => {
    expect(chunkRows([], 3)).toEqual([]);
  });
});
