import { describe, expect, it } from "vitest";
import { filterCustomers, filterProducts, normalizeForSearch } from "./catalog";
import type { LocalCustomer, LocalProduct } from "./types";

/** Monta um produto da base local com o campo de busca já normalizado. */
function product(id: number, name: string, barcode: string, stock = 10): LocalProduct {
  return {
    id,
    name,
    barcode,
    price: 10,
    stock,
    status: 2,
    productGroupId: 1,
    searchName: normalizeForSearch(name),
  };
}

/** Monta um cliente da base local com o campo de busca já normalizado. */
function customer(id: number, name: string, document: string | null): LocalCustomer {
  return { id, name, document, phone: null, searchName: normalizeForSearch(name) };
}

const CATALOG = [
  product(1, "Café torrado", "111"),
  product(2, "Caneta azul", "222"),
  product(3, "Descafeinado premium", "333"),
  product(4, "Borracha", "1112"),
];

describe("normalizeForSearch", () => {
  it("deve remover acentos e baixar a caixa", () => {
    expect(normalizeForSearch("Café João ÁÉÍÓÚ")).toBe("cafe joao aeiou");
  });
});

describe("filterProducts", () => {
  it("deve devolver vazio com o termo em branco", () => {
    expect(filterProducts(CATALOG, "   ")).toEqual([]);
  });

  it("deve achar por nome ignorando acento", () => {
    // O operador digita "cafe" e precisa achar "Café".
    expect(filterProducts(CATALOG, "cafe").map((p) => p.id)).toEqual([1, 3]);
  });

  it("deve priorizar o código de barras exato", () => {
    // Leitor bipando: o match exato tem que vir primeiro, senão o produto de
    // código parecido entraria no carrinho.
    expect(filterProducts(CATALOG, "111")[0].id).toBe(1);
  });

  it("deve priorizar nome que começa com o termo sobre nome que contém", () => {
    expect(filterProducts(CATALOG, "cafe").map((p) => p.name)).toEqual([
      "Café torrado",
      "Descafeinado premium",
    ]);
  });

  it("deve achar por código de barras parcial", () => {
    expect(filterProducts(CATALOG, "1112").map((p) => p.id)).toEqual([4]);
  });

  it("deve respeitar o limite de resultados", () => {
    expect(filterProducts(CATALOG, "a", 2)).toHaveLength(2);
  });

  it("não deve trazer produto que não casa com o termo", () => {
    expect(filterProducts(CATALOG, "xyz")).toEqual([]);
  });
});

describe("filterCustomers", () => {
  const CUSTOMERS = [
    customer(1, "Ana Souza", "123.456.789-01"),
    customer(2, "Bruno Émerson", "98765432100"),
    customer(3, "Carla", null),
  ];

  it("deve achar por nome ignorando acento", () => {
    expect(filterCustomers(CUSTOMERS, "emerson").map((c) => c.id)).toEqual([2]);
  });

  it("deve achar por documento sem pontuação", () => {
    // O cadastro guarda com pontos, o operador digita só os números.
    expect(filterCustomers(CUSTOMERS, "12345678901").map((c) => c.id)).toEqual([1]);
  });

  it("deve achar por documento com pontuação", () => {
    expect(filterCustomers(CUSTOMERS, "987.654.321-00").map((c) => c.id)).toEqual([2]);
  });

  it("deve ignorar cliente sem documento na busca por número", () => {
    expect(filterCustomers(CUSTOMERS, "999")).toEqual([]);
  });

  it("deve devolver vazio com o termo em branco", () => {
    expect(filterCustomers(CUSTOMERS, "")).toEqual([]);
  });
});
