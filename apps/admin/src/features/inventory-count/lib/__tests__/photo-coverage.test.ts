import { describe, expect, it } from "vitest";
import type { InventoryCountItemDto } from "@workspace/api-client-react";

import { photoCoverage } from "../photo-coverage";

function item(variationsCount: number, hasImage: boolean): InventoryCountItemDto {
  return {
    id: 1,
    productGroupId: 1,
    productGroupName: "BACIA",
    categoryName: "Utilidades",
    variationsCount,
    hasImage,
    imageUrl: null,
    stock: 0,
    stockAtSnapshot: 0,
    price: 0,
    reviewed: false,
  };
}

describe("photoCoverage", () => {
  it("não avisa nada quando o cadastro tem foto", () => {
    expect(photoCoverage(item(3, true))).toBe("complete");
  });

  it("trata o cadastro sem foto como defeito", () => {
    expect(photoCoverage(item(3, false))).toBe("missing");
  });

  it("não depende do número de variações", () => {
    // A galeria é do GRUPO desde 12/09/2026: uma variação ou dez, a resposta é
    // a mesma. O estado "pela metade" deixou de existir com o modelo antigo.
    expect(photoCoverage(item(1, true))).toBe("complete");
    expect(photoCoverage(item(10, true))).toBe("complete");
  });

  it("cadastro sem variação viva e sem foto conta como sem foto", () => {
    // É justamente o cadastro órfão que a conferência existe para achar.
    expect(photoCoverage(item(0, false))).toBe("missing");
  });
});
