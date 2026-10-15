import { describe, expect, it } from "vitest";
import { spreadRestockQuantity } from "../spread-restock";

describe("spreadRestockQuantity", () => {
  it("completa primeiro quem tem menos e termina com as variações niveladas", () => {
    // Sacola: FLORES 0, XADREZ 2, LISA 5. Comprar 9 leva todas a 5 e reparte o resto.
    const parte = spreadRestockQuantity(9, [
      { productId: 1, stock: 0, sellable: true },
      { productId: 2, stock: 2, sellable: true },
      { productId: 3, stock: 5, sellable: true },
    ]);

    expect([...parte.values()]).toEqual([6, 3, 0]);
    expect([...parte.values()].reduce((a, b) => a + b, 0)).toBe(9);
  });

  it("no empate, segue a ordem da grade", () => {
    const parte = spreadRestockQuantity(5, [
      { productId: 1, stock: 0, sellable: true },
      { productId: 2, stock: 0, sellable: true },
    ]);

    expect([...parte.values()]).toEqual([3, 2]);
  });

  it("variação inativa ou rascunho não recebe nada", () => {
    const parte = spreadRestockQuantity(4, [
      { productId: 1, stock: 0, sellable: false },
      { productId: 2, stock: 1, sellable: true },
    ]);

    expect(parte.get(1)).toBe(0);
    expect(parte.get(2)).toBe(4);
  });

  it("saldo negativo conta como zero, e sem vendável a grade nasce zerada", () => {
    expect(
      spreadRestockQuantity(2, [
        { productId: 1, stock: -3, sellable: true },
        { productId: 2, stock: 0, sellable: true },
      ]).get(1),
    ).toBe(1);
    expect([...spreadRestockQuantity(3, [{ productId: 1, stock: 0, sellable: false }]).values()]).toEqual([
      0,
    ]);
  });
});
