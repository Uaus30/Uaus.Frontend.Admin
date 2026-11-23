import { describe, expect, it } from "vitest";
import { purchaseBandFor } from "./purchase-band";

/**
 * As bordas da faixa de compras (PLANO-FINANCEIRO.md, seção 9). Os números de
 * novembro/2026 vêm da seção 1.1: V = 5.358, C = 3.220, F = 865.
 */
describe("purchaseBandFor", () => {
  /** Linhas a partir de V, C, F, S e A, como o backend as calcula. */
  function lines(v: number, c: number, f: number, s = 0, a = 0) {
    return { green: c + s + a, red: v + s + a - f };
  }

  it("mês sem venda e sem compra é verde", () => {
    const { green, red } = lines(0, 0, 865);

    expect(purchaseBandFor(0, green, red)).toBe("green");
  });

  it("gastar exatamente a linha verde é verde; um centavo acima, com folga, é amarelo", () => {
    const { green, red } = lines(5358, 3220, 865);

    expect(purchaseBandFor(3220, green, red)).toBe("green");
    expect(purchaseBandFor(3220.01, green, red)).toBe("yellow");
  });

  it("gastar exatamente a linha vermelha é amarelo; um centavo acima é vermelho", () => {
    const { green, red } = lines(5358, 3220, 865);

    expect(purchaseBandFor(4493, green, red)).toBe("yellow");
    expect(purchaseBandFor(4493.01, green, red)).toBe("red");
  });

  it("o verde é testado primeiro: começo do mês com V − F negativo e K ≤ C é verde", () => {
    // Decisão 7: as vendas ainda não cobrem os fixos (linha vermelha < 0), mas
    // comprar o que se vendeu, a custo, repõe a prateleira.
    const { green, red } = lines(300, 180, 865);

    expect(red).toBeLessThan(0);
    expect(purchaseBandFor(150, green, red)).toBe("green");
    expect(purchaseBandFor(181, green, red)).toBe("red");
  });

  it("o aporte leva o mês de vermelho a amarelo e a verde, e o saldo inicial vale igual", () => {
    // V = 3.000, C = 1.200, F = 865 e R$ 2.500 de compras: o aporte sobe as
    // duas linhas juntas, primeiro passando da vermelha, depois da verde.
    const spent = 2500;

    expect(purchaseBandFor(spent, ...asTuple(lines(3000, 1200, 865)))).toBe("red");
    expect(purchaseBandFor(spent, ...asTuple(lines(3000, 1200, 865, 0, 500)))).toBe("yellow");
    expect(purchaseBandFor(spent, ...asTuple(lines(3000, 1200, 865, 0, 1300)))).toBe("green");
    expect(purchaseBandFor(spent, ...asTuple(lines(3000, 1200, 865, 1300)))).toBe("green");
  });

  it("o saldo inicial tira o começo do mês do vermelho (novembro, seção 1.2)", () => {
    // R$ 991 de compras nos dias 1 e 2, sem venda: vermelho sem saldo, verde
    // com os R$ 1.727 que outubro deixou.
    expect(purchaseBandFor(991, ...asTuple(lines(0, 0, 865)))).toBe("red");
    expect(purchaseBandFor(991, ...asTuple(lines(0, 0, 865, 1727)))).toBe("green");
  });

  it("compara em centavos: a soma em ponto flutuante no limite exato continua verde", () => {
    // 0,1 + 0,2 é 0,30000000000000004 em binário.
    expect(purchaseBandFor(0.1 + 0.2, 0.3, 0)).toBe("green");
  });
});

function asTuple({ green, red }: { green: number; red: number }): [number, number] {
  return [green, red];
}
