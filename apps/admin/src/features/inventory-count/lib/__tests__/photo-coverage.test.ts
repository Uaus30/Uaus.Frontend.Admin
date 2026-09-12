import { describe, expect, it } from "vitest";
import type { InventoryCountItemDto } from "@workspace/api-client-react";

import { photoCoverage } from "../photo-coverage";

function item(variationsCount: number, variationsWithoutImage: number): InventoryCountItemDto {
  return {
    id: 1,
    productGroupId: 1,
    productGroupName: "BACIA",
    categoryName: "Utilidades",
    variationsCount,
    variationsWithoutImage,
    imageUrl: null,
    stock: 0,
    stockAtSnapshot: 0,
    price: 0,
    reviewed: false,
  };
}

describe("photoCoverage", () => {
  it("não avisa nada quando toda variação tem foto", () => {
    expect(photoCoverage(item(3, 0))).toBe("complete");
  });

  it("trata o cadastro inteiro sem foto como defeito", () => {
    expect(photoCoverage(item(3, 3))).toBe("missing");
  });

  it("trata a metade sem foto como atenção", () => {
    expect(photoCoverage(item(5, 2))).toBe("partial");
  });

  it("cadastro sem variação viva conta como sem foto", () => {
    // Não há foto porque não há produto — e é justamente o cadastro órfão que a
    // conferência existe para achar. "complete" o esconderia.
    expect(photoCoverage(item(0, 0))).toBe("missing");
  });
});
