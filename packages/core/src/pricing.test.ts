import { describe, expect, it } from "vitest";
import { marginPercent, markupPercent, suggestedPrice } from "./pricing";

describe("marginPercent", () => {
  it.each([
    [10, 15, 33.33],
    [10, 16.7, 40.12],
    [6, 10, 40],
    [10, 8, -25],
    [0, 10, 100],
  ])("custo %s a preco %s tem margem de %s%%", (custo, preco, esperado) => {
    expect(marginPercent(custo, preco)).toBe(esperado);
  });

  it("não calcula sem preço", () => {
    // Sem preço não há base para a divisão; a tela esconde o indicador em vez
    // de mostrar -Infinity ou NaN.
    expect(marginPercent(10, 0)).toBeNull();
    expect(marginPercent(10, Number.NaN)).toBeNull();
    expect(marginPercent(-1, 10)).toBeNull();
  });
});

describe("markupPercent", () => {
  it.each([
    [10, 15, 50],
    [6, 10, 66.67],
    [10, 8, -20],
  ])("custo %s a preco %s tem markup de %s%%", (custo, preco, esperado) => {
    expect(markupPercent(custo, preco)).toBe(esperado);
  });

  it("não calcula sem custo", () => {
    // Brinde e bonificação entram a custo zero: markup "infinito" não é
    // informação, é ruído.
    expect(markupPercent(0, 10)).toBeNull();
    expect(markupPercent(10, -1)).toBeNull();
  });
});

describe("suggestedPrice", () => {
  it.each([
    // custo / 0,6 arredondado ao múltiplo de 0,10 mais próximo
    [10, 16.7], // 16,666…
    [3.5, 5.8], // 5,833…
    [6, 10], // 10 exato
    [1, 1.7], // 1,666…
    [0.5, 0.8], // 0,833…
    [12.99, 21.7], // 21,65 → meio exato sobe
  ])("custo %s sugere %s a 40%% de margem", (custo, esperado) => {
    expect(suggestedPrice(custo)).toBe(esperado);
  });

  it("fica próximo da margem alvo, para cima ou para baixo", () => {
    // A regra é "algo próximo de 40%": o arredondamento ao múltiplo mais
    // próximo ora fica um pouco acima, ora um pouco abaixo — nunca longe.
    for (const custo of [0.7, 1.3, 2.9, 4.4, 7.77, 19.9, 33.33]) {
      const preco = suggestedPrice(custo);
      expect(preco).not.toBeNull();
      const margem = marginPercent(custo, preco as number) as number;
      expect(Math.abs(margem - 40)).toBeLessThan(4);
    }
  });

  it("aceita outra margem alvo e outro passo", () => {
    expect(suggestedPrice(10, 50)).toBe(20);
    expect(suggestedPrice(10, 40, 1)).toBe(17);
    expect(suggestedPrice(10, 0)).toBe(10);
  });

  it("não sugere sem custo nem com margem impossível", () => {
    // Sugerir zero zeraria o preço do produto no cadastro — o mesmo buraco que
    // a validação da entrada fechou do outro lado.
    expect(suggestedPrice(0)).toBeNull();
    expect(suggestedPrice(-5)).toBeNull();
    expect(suggestedPrice(Number.NaN)).toBeNull();
    expect(suggestedPrice(10, 100)).toBeNull();
    expect(suggestedPrice(10, 40, 0)).toBeNull();
  });
});
