import { describe, expect, it } from "vitest";
import type { SupplierDto } from "@workspace/api-client-react";
import { compareNames, orderByName, orderCatalogByName, orderSupplierOptions } from "../select-options";

function supplier(id: number, name: string): SupplierDto {
  return { id, name } as SupplierDto;
}

describe("compareNames", () => {
  it("ignora acento e caixa", () => {
    // Com o comparador ordinal "Água" cairia depois de "Zeta", porque o acento
    // vale mais que a letra no code point.
    expect(compareNames("Água", "Zeta")).toBeLessThan(0);
    expect(compareNames("abacate", "Abacaxi")).toBeLessThan(0);
  });

  it("ordena número como número", () => {
    // Caractere a caractere, "Máximo 100" viria antes de "Máximo 20".
    expect(compareNames("Máximo 20", "Máximo 100")).toBeLessThan(0);
  });
});

describe("orderByName / orderCatalogByName", () => {
  it("devolve uma cópia ordenada, sem mexer na lista original", () => {
    // A lista vem do cache do React Query: ordenar no lugar mutaria o que
    // outras telas já leram.
    const original = [{ name: "Zeta" }, { name: "Água" }, { name: "abacate" }];

    expect(orderCatalogByName(original).map((item) => item.name)).toEqual(["abacate", "Água", "Zeta"]);
    expect(original.map((item) => item.name)).toEqual(["Zeta", "Água", "abacate"]);
  });

  it("aceita um extrator de nome para listas com outro formato", () => {
    const opcoes = [{ label: "Perda" }, { label: "Avaria" }];

    expect(orderByName(opcoes, (item) => item.label).map((item) => item.label)).toEqual(["Avaria", "Perda"]);
  });
});

describe("orderSupplierOptions", () => {
  it("põe a Shopee primeiro e ordena os demais alfabeticamente", () => {
    const suppliers = [
      supplier(10, "Zeta"),
      supplier(3, "Água"),
      supplier(13, "Shopee"),
      supplier(4, "abacate"),
    ];

    expect(orderSupplierOptions(suppliers).map(({ id }) => id)).toEqual([13, 4, 3, 10]);
    expect(suppliers.map(({ id }) => id)).toEqual([10, 3, 13, 4]);
  });

  it("acha a Shopee pelo NOME, seja qual for o id", () => {
    // Regressão: a versão anterior fixava o id 6, que em dev é "Max
    // Atacadista" — a lista abria no fornecedor errado, e o id da Shopee não
    // é o mesmo em todo ambiente.
    const suppliers = [supplier(6, "Max Atacadista"), supplier(13, "shopee ")];

    expect(orderSupplierOptions(suppliers).map(({ id }) => id)).toEqual([13, 6]);
  });

  it("ordena alfabeticamente quando não há Shopee", () => {
    const suppliers = [supplier(10, "Zeta"), supplier(3, "Água"), supplier(4, "abacate")];

    expect(orderSupplierOptions(suppliers).map(({ id }) => id)).toEqual([4, 3, 10]);
  });
});
