import { describe, expect, it } from "vitest";
import {
  MAX_SALE_PRICE,
  exceedsMaxSalePrice,
  isBelowCost,
  marginBand,
  marginPercent,
  markupPercent,
  suggestedPrice,
  suggestedSalePrice,
} from "./pricing";

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

  it("não calcula sem custo nem sem preço", () => {
    // Brinde e bonificação entram a custo zero: markup "infinito" não é
    // informação, é ruído. Sem preço, -100% pareceria um markup negativo real.
    expect(markupPercent(0, 10)).toBeNull();
    expect(markupPercent(10, -1)).toBeNull();
    expect(markupPercent(10, 0)).toBeNull();
  });
});

describe("suggestedPrice", () => {
  it.each([
    // custo / 0,6 arredondado ao múltiplo de 0,10 PARA CIMA
    [10, 16.7], // 16,666…
    [3.5, 5.9], // 5,833…
    [8.9, 14.9], // 14,833… — o caso que expôs o arredondamento para baixo
    [6, 10], // 10 exato: o ceil não pode virar 10,10
    [1, 1.7], // 1,666…
    [0.5, 0.9], // 0,833…
    [33.33, 55.6], // 55,55
  ])("custo %s sugere %s a 40%% de margem", (custo, esperado) => {
    expect(suggestedPrice(custo)).toBe(esperado);
  });

  it("nunca sugere um preço ABAIXO da margem alvo", () => {
    // É a razão de arredondar para cima: com o múltiplo mais próximo, custo
    // 8,90 sugeria 14,80 — 39,9% — e a tela dizia "40% de margem".
    for (const custo of [0.7, 1.3, 2.9, 3.5, 4.4, 7.77, 8.9, 19.9, 33.33]) {
      const preco = suggestedPrice(custo);
      expect(preco).not.toBeNull();
      const margem = marginPercent(custo, preco as number) as number;
      expect(margem).toBeGreaterThanOrEqual(40);
      // E não longe dele: o passo é de 10 centavos, não uma licença para subir.
      expect(margem).toBeLessThan(45);
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

describe("marginBand", () => {
  it.each([
    [60, "healthy"],
    [40, "healthy"],
    [39.99, "tight"],
    [30, "tight"],
    [29.99, "thin"],
    [25.83, "thin"],
    [20, "thin"],
    [19.99, "low"],
    [0, "low"],
    [-20, "low"],
  ])("margem de %s%% cai na faixa %s", (margem, esperado) => {
    // Os cortes são a regra do dono (22/10/2026): verde a partir de 40%,
    // amarelo-limão de 30% a 40%, laranja de 20% a 30% e vermelho abaixo de 20%.
    // Cada borda é do degrau de CIMA: 30% já é amarelo, 20% já é laranja.
    expect(marginBand(margem)).toBe(esperado);
  });

  it("não classifica o que não tem margem", () => {
    expect(marginBand(null)).toBeNull();
    expect(marginBand(Number.NaN)).toBeNull();
  });
});

describe("teto do preço de venda", () => {
  it("a sugestão pela margem para no teto da loja", () => {
    // Custo 20 pede 33,40 para 40% de margem; a loja não vende acima de 30.
    expect(suggestedPrice(20)).toBe(33.4);
    expect(suggestedSalePrice(20)).toBe(MAX_SALE_PRICE);
    expect(suggestedSalePrice(8.9)).toBe(14.9);
    expect(suggestedSalePrice(0)).toBeNull();
  });

  it("só passa do teto o que é maior que 30", () => {
    expect(exceedsMaxSalePrice(30)).toBe(false);
    expect(exceedsMaxSalePrice(30.01)).toBe(true);
    expect(exceedsMaxSalePrice(0)).toBe(false);
  });
});

describe("isBelowCost", () => {
  it.each([
    [35, 30, true],
    [30, 30, false],
    [10, 15, false],
    [0, 10, false],
    [10, 0, false],
  ])("custo %s e preço %s: abaixo do custo = %s", (custo, preco, esperado) => {
    expect(isBelowCost(custo, preco)).toBe(esperado);
  });
});
