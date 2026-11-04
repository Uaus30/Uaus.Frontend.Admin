import { describe, expect, it } from "vitest";
import type { ShelfPrice } from "@workspace/core";
import type { ProductTableRow } from "../../types";
import { spotlightBannerOptions } from "../spotlightBannerOptions";

/** Só o que a regra lê: o preço com a promoção de agora e a marca de reposição. */
function row(overrides: Partial<ProductTableRow> = {}): ProductTableRow {
  return { productGroupId: 825, name: "COPO", price: 9.9, ...overrides } as ProductTableRow;
}

const kinds = (product: ProductTableRow) => spotlightBannerOptions(product).map((option) => option.kind);

describe("spotlightBannerOptions", () => {
  it("a novidade sempre, por padrão — também para produto antigo (decisão do dono, 04/11/2026)", () => {
    expect(kinds(row())).toEqual(["new"]);
  });

  it("o promocional só com promoção no preço de agora: relâmpago, Dia a Dia ou combo", () => {
    const unit = { kind: "unit", price: 7.9, referencePrice: 9.9 } as ShelfPrice;
    const combo = { kind: "combo", price: 9.9, offer: "3 por R$ 25,00" } as ShelfPrice;
    const regular: ShelfPrice = { kind: "regular", price: 9.9 };

    expect(kinds(row({ shelf: unit }))).toEqual(["new", "offer"]);
    expect(kinds(row({ shelf: combo }))).toEqual(["new", "offer"]);
    expect(kinds(row({ shelf: regular }))).toEqual(["new"]);
  });

  it("a reposição só quando o servidor marca a linha", () => {
    expect(kinds(row({ isRecentRestock: true }))).toEqual(["new", "restock"]);
    expect(kinds(row({ isRecentRestock: false }))).toEqual(["new"]);
  });

  it("os rótulos são os do dono", () => {
    expect(
      spotlightBannerOptions(
        row({ isRecentRestock: true, shelf: { kind: "combo", price: 1, offer: "" } as ShelfPrice }),
      ).map((option) => option.label),
    ).toEqual(["Banner de novidade", "Banner promocional", "Banner de reposição"]);
  });
});
