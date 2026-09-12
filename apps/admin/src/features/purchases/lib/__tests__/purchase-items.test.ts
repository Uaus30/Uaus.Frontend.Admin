import { describe, expect, it } from "vitest";

import { applyCostSplit, splitPurchaseTotal, sumItems } from "../purchase-items";
import type { PurchaseFormItem } from "../../types";

function linha(productId: number, quantity: number): PurchaseFormItem {
  return {
    productId,
    name: `VAR ${productId}`,
    barcode: null,
    stock: 0,
    quantity,
    grossTotal: 0,
    finalTotal: 0,
  };
}

describe("splitPurchaseTotal", () => {
  it("rateia proporcional à quantidade", () => {
    expect(splitPurchaseTotal(100, [1, 1, 2])).toEqual([25, 25, 50]);
  });

  it("joga a sobra do arredondamento no último item", () => {
    // R$ 100 em três não fecha: 33,33 × 3 = 99,99. Sem a sobra, a soma da grade
    // contradiz o total que o operador acabou de digitar, na mesma tela.
    const fatias = splitPurchaseTotal(100, [1, 1, 1]);

    expect(fatias).toEqual([33.33, 33.33, 33.34]);
    expect(fatias.reduce((soma, fatia) => soma + fatia, 0)).toBe(100);
  });

  it("a soma é sempre o total, em qualquer grade", () => {
    for (const total of [100, 0.01, 1234.56, 7]) {
      for (const grade of [[1], [1, 1], [1, 2, 3], [7, 1, 1, 1, 1, 1]]) {
        const soma = splitPurchaseTotal(total, grade).reduce((a, b) => a + b, 0);
        expect(Math.round(soma * 100) / 100).toBe(total);
      }
    }
  });

  it("sem quantidade devolve zeros", () => {
    expect(splitPurchaseTotal(100, [0, 0])).toEqual([0, 0]);
    expect(splitPurchaseTotal(100, [])).toEqual([]);
  });
});

describe("applyCostSplit", () => {
  it("distribui só entre as variações compradas", () => {
    // A grade mostra TODAS as variações do grupo; a não comprada não entra na
    // conta nem fica com fatia.
    const grade = applyCostSplit([linha(1, 2), linha(2, 0), linha(3, 2)], 0, 100, false);

    expect(grade.map((item) => item.finalTotal)).toEqual([50, 0, 50]);
  });

  it("não mexe em nada no modo manual", () => {
    // O que o operador digitou é o que vale; recalcular apagaria o trabalho dele
    // — que é exatamente o caso da variação mais cara.
    const digitado = [
      { ...linha(1, 1), finalTotal: 40 },
      { ...linha(2, 1), finalTotal: 70 },
    ];

    expect(applyCostSplit(digitado, 0, 999, true)).toEqual(digitado);
  });
});

describe("sumItems", () => {
  it("soma a grade sem arrastar erro de ponto flutuante", () => {
    const grade = [
      { ...linha(1, 1), finalTotal: 33.33 },
      { ...linha(2, 1), finalTotal: 33.33 },
      { ...linha(3, 1), finalTotal: 33.34 },
    ];

    expect(sumItems(grade, "finalTotal")).toBe(100);
    expect(sumItems(grade, "quantity")).toBe(3);
  });
});
