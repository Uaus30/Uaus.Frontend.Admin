import { describe, expect, it } from "vitest";
import { chunkRows, STORY, STORY_MAX_PRODUCTS, storyGrid } from "../geometry";

const PANEL_INNER_WIDTH = STORY.width - 2 * STORY.panelPaddingX;
const PANEL_INNER_HEIGHT = STORY.height - STORY.panelTop - STORY.footerHeight - 2 * STORY.panelPaddingY;

describe("storyGrid", () => {
  it("o banner cheio são 3 colunas por 3 linhas", () => {
    const grid = storyGrid(9);

    expect(grid).toMatchObject({ columns: 3, rows: 3, scale: 1 });
  });

  it("até 4 produtos usam 2 colunas, com card e texto maiores", () => {
    const grid = storyGrid(4);

    expect(grid).toMatchObject({ columns: 2, rows: 2 });
    expect(grid.scale).toBeGreaterThan(1);
  });

  it("5 e 6 produtos já são 3 colunas em 2 linhas", () => {
    expect(storyGrid(5)).toMatchObject({ columns: 3, rows: 2 });
    expect(storyGrid(6)).toMatchObject({ columns: 3, rows: 2 });
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])("com %i produto(s) a grade cabe dentro do painel", (count) => {
    const grid = storyGrid(count);

    const width = grid.columns * grid.cardWidth + (grid.columns - 1) * STORY.gap;
    const height = grid.rows * grid.cardHeight + (grid.rows - 1) * STORY.gap;

    expect(width).toBeLessThanOrEqual(PANEL_INNER_WIDTH);
    expect(height).toBeLessThanOrEqual(PANEL_INNER_HEIGHT);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])("com %i produto(s) sobra altura positiva para a foto", (count) => {
    const grid = storyGrid(count);

    expect(grid.photoHeight).toBeGreaterThan(grid.cardHeight / 2);
  });

  it("o card nunca passa de 1,35 da própria largura, nem com uma linha só", () => {
    const grid = storyGrid(2);

    expect(grid.cardHeight).toBeLessThanOrEqual(Math.round(grid.cardWidth * 1.35));
  });

  it("lista vazia e lista acima do teto não quebram a conta", () => {
    expect(storyGrid(0)).toMatchObject({ columns: 2, rows: 1 });
    expect(storyGrid(40)).toEqual(storyGrid(STORY_MAX_PRODUCTS));
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
