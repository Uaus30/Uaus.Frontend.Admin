import { describe, expect, it } from "vitest";
import { CLASS_INFO, coberturaLegivel, tomDaCobertura, tomDaNota } from "../performance";

describe("vocabulário do desempenho de produtos", () => {
  it("o tom da nota usa os MESMOS cortes que o backend usou para classificar", () => {
    // Dois cortes diferentes fariam a pílula verde aparecer ao lado do rótulo
    // "Regular", que é o pior tipo de erro numa tela de leitura rápida.
    expect(tomDaNota(85, 70, 40)).toBe("bom");
    expect(tomDaNota(70, 70, 40)).toBe("bom");
    expect(tomDaNota(55, 70, 40)).toBe("neutro");
    expect(tomDaNota(20, 70, 40)).toBe("atencao");
    expect(tomDaNota(0, 70, 40)).toBe("ruim");
  });

  it("a cobertura vira texto que se compara com 'a próxima compra'", () => {
    expect(coberturaLegivel(null, 0)).toBe("esgotado");
    expect(coberturaLegivel(null, 12)).toBe("sem giro");
    expect(coberturaLegivel(0.4, 5)).toBe("acaba hoje");
    expect(coberturaLegivel(18, 5)).toBe("18 dias");
    expect(coberturaLegivel(120, 30)).toBe("4 meses");
    // 1.035 dias é preciso e ilegível; "2.8 anos" se compara de cabeça.
    expect(coberturaLegivel(1035, 92)).toBe("2.8 anos");
  });

  it("cobertura curta é atenção e mais de um ano é dinheiro dormindo", () => {
    expect(tomDaCobertura(7, 5, 21, 365)).toBe("atencao");
    expect(tomDaCobertura(120, 30, 21, 365)).toBe("neutro");
    expect(tomDaCobertura(1035, 92, 21, 365)).toBe("ruim");
    expect(tomDaCobertura(null, 12, 21, 365)).toBe("ruim");
  });

  it("a faixa do meio fica sem cor, e o produto novo fica em cinza", () => {
    // Colorir os três estados gastaria o contraste que faz os extremos
    // saltarem, que é a única coisa que se enxerga num ranking de cem linhas.
    expect(CLASS_INFO.Standout.tom).toBe("bom");
    expect(CLASS_INFO.Steady.tom).toBe("neutro");
    expect(CLASS_INFO.Weak.tom).toBe("atencao");
    expect(CLASS_INFO.Stalled.tom).toBe("ruim");
    expect(CLASS_INFO.New.tom).toBe("mudo");
  });
});
