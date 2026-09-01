import { describe, expect, it } from "vitest";
import { parseColor, readableTextColor, relativeLuminance, TEXT_ON_DARK, TEXT_ON_LIGHT } from "../contrast";

/**
 * O que estes testes protegem: o selo do produto usa a cor cadastrada no admin
 * como fundo. Enquanto o texto era branco fixo, etiqueta clara saía ilegível
 * sobre a foto — e o dado que causa isso (a cor) não está sob controle do
 * front. A regressão a evitar é o cálculo deixar de virar em algum tom.
 */
describe("readableTextColor", () => {
  it("usa texto branco em fundo escuro", () => {
    expect(readableTextColor("#0F1729")).toBe(TEXT_ON_DARK);
    expect(readableTextColor("#C24F09")).toBe(TEXT_ON_DARK);
    expect(readableTextColor("#008236")).toBe(TEXT_ON_DARK);
  });

  it("vira para texto escuro em fundo claro — o caso da etiqueta amarela", () => {
    expect(readableTextColor("#FFE066")).toBe(TEXT_ON_LIGHT);
    expect(readableTextColor("#FFFFFF")).toBe(TEXT_ON_LIGHT);
    expect(readableTextColor("#F1F5F9")).toBe(TEXT_ON_LIGHT);
  });

  it("cai em branco quando a cor não é reconhecida, em vez de quebrar o selo", () => {
    expect(readableTextColor("verde")).toBe(TEXT_ON_DARK);
    expect(readableTextColor("")).toBe(TEXT_ON_DARK);
    expect(readableTextColor("#12345")).toBe(TEXT_ON_DARK);
  });

  it("escolhe o texto de MAIOR contraste real, e não por gosto", () => {
    // O laranja da marca é o caso limite que motivou a régua: sobre ele, texto
    // escuro tem contraste maior que branco (2,69:1 do branco).
    const orange = parseColor("#FF751A");
    expect(orange).not.toBeNull();

    const l = relativeLuminance(orange!);
    const vsWhite = 1.05 / (l + 0.05);
    const vsDark = (l + 0.05) / (relativeLuminance([15, 23, 41]) + 0.05);

    expect(vsDark).toBeGreaterThan(vsWhite);
    expect(readableTextColor("#FF751A")).toBe(TEXT_ON_LIGHT);
  });
});

describe("parseColor", () => {
  it("aceita as formas que o cadastro produz", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255]);
    expect(parseColor("#FF751A")).toEqual([255, 117, 26]);
    expect(parseColor("rgb(255, 117, 26)")).toEqual([255, 117, 26]);
    expect(parseColor("  #0f1729  ")).toEqual([15, 23, 41]);
  });

  it("recusa o que não é cor", () => {
    expect(parseColor("#GGGGGG")).toBeNull();
    expect(parseColor("rgb(300, 0, 0)")).toBeNull();
    expect(parseColor("azul")).toBeNull();
  });
});
