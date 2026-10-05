import { describe, expect, it } from "vitest";
import type { CatalogProduct, CatalogRole } from "../../types";
import { groupSwapsByRole, matchReplacements } from "../swapPlan";

function product(id: number, role: CatalogRole = "regular"): CatalogProduct {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasPriceRange: false,
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    role,
  };
}

const ids = (products: readonly CatalogProduct[]) => products.map((item) => item.productGroupId);

const PIECE = [
  product(1, "new"),
  product(2, "slow"),
  product(3, "new"),
  product(4, "offer"),
  product(5, "slow"),
];

describe("groupSwapsByRole", () => {
  it("junta pelo papel, na ordem da peça — e não na ordem em que foram marcados", () => {
    const swaps = groupSwapsByRole(PIECE, [5, 3, 2, 1]);

    expect(swaps.map((swap) => [swap.role, ids(swap.leaving)])).toEqual([
      ["new", [1, 3]],
      ["slow", [2, 5]],
    ]);
  });

  it("id que não está na peça é ignorado, e repetido conta uma vez", () => {
    expect(groupSwapsByRole(PIECE, [999, 4, 4]).map((swap) => ids(swap.leaving))).toEqual([[4]]);
  });

  it("sem marcado não há pedido", () => {
    expect(groupSwapsByRole(PIECE, [])).toEqual([]);
  });
});

describe("matchReplacements", () => {
  const inPiece = ids(PIECE);

  it("o primeiro sorteado entra no lugar do primeiro marcado do papel", () => {
    const swaps = groupSwapsByRole(PIECE, [1, 3, 2]);

    const replacements = matchReplacements(
      swaps,
      [[product(10, "new"), product(11, "new")], [product(20)]],
      inPiece,
    );

    expect([...replacements].map(([leaving, replacement]) => [leaving, replacement.productGroupId])).toEqual([
      [1, 10],
      [3, 11],
      [2, 20],
    ]);
  });

  it("o servidor devolveu menos: os últimos marcados daquele papel ficam", () => {
    const swaps = groupSwapsByRole(PIECE, [1, 3]);

    const replacements = matchReplacements(swaps, [[product(10, "new")]], inPiece);

    expect([...replacements.keys()]).toEqual([1]);
  });

  it("substituto repetido entre dois sorteios, ou já na peça, é descartado", () => {
    // Sem produto do papel, o servidor completa com outros — dois sorteios
    // podem trazer o mesmo cadastro.
    const swaps = groupSwapsByRole(PIECE, [1, 2]);

    const replacements = matchReplacements(swaps, [[product(10)], [product(10), product(4)]], inPiece);

    expect([...replacements].map(([leaving, replacement]) => [leaving, replacement.productGroupId])).toEqual([
      [1, 10],
    ]);
  });

  it("sorteio vazio não troca nada", () => {
    expect(matchReplacements(groupSwapsByRole(PIECE, [2]), [[]], inPiece).size).toBe(0);
  });
});
