import { describe, expect, it } from "vitest";
import { findStockShortages } from "./stock";
import type { LocalProduct } from "./types";

/** Monta um produto da base local com o estoque informado. */
function product(id: number, name: string, stock: number): LocalProduct {
  return {
    id,
    name,
    barcode: `${id}`,
    price: 10,
    stock,
    status: 2,
    productGroupId: 1,
    searchName: name.toLowerCase(),
  };
}

const CATALOG = [product(1, "Café", 5), product(2, "Caneta", 0)];

describe("findStockShortages", () => {
  it("deve aceitar quantidade dentro do estoque", () => {
    expect(findStockShortages(CATALOG, [{ productId: 1, quantity: 5 }])).toEqual([]);
  });

  it("deve apontar quantidade acima do estoque", () => {
    const shortages = findStockShortages(CATALOG, [{ productId: 1, quantity: 6 }]);

    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({
      productId: 1,
      productName: "Café",
      requested: 6,
      available: 5,
    });
  });

  it("deve apontar produto zerado", () => {
    expect(findStockShortages(CATALOG, [{ productId: 2, quantity: 1 }])).toHaveLength(1);
  });

  it("deve apontar produto ausente da base local", () => {
    // Snapshot anterior ao cadastro do produto: sem saber o saldo, a venda
    // offline não pode seguir.
    const shortages = findStockShortages(CATALOG, [{ productId: 99, quantity: 1 }]);

    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({ productId: 99, available: 0 });
  });

  it("deve apontar todos os itens com falta, não só o primeiro", () => {
    const shortages = findStockShortages(CATALOG, [
      { productId: 1, quantity: 99 },
      { productId: 2, quantity: 1 },
    ]);

    expect(shortages.map((item) => item.productId)).toEqual([1, 2]);
  });

  it("deve aceitar venda sem itens", () => {
    expect(findStockShortages(CATALOG, [])).toEqual([]);
  });
});
