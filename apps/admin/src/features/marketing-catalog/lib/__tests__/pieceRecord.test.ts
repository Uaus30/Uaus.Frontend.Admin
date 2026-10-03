import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogProduct } from "../../types";
import { CATALOG_FORMATS } from "../formats";
import { newPieceKey, toPieceRecord } from "../pieceRecord";
import type { CatalogThemeOption } from "../themes";

const theme: CatalogThemeOption = {
  key: "5:7",
  theme: 5,
  departmentId: 7,
  label: "Brinquedos",
  title: "Brinquedos",
  products: 15,
  productsWithLargePhoto: 9,
};

function product(id: number, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasPriceRange: false,
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    role: "regular",
    ...overrides,
  };
}

describe("toPieceRecord", () => {
  it("leva a chave, o tema, o formato em código e o título impresso", () => {
    const record = toPieceRecord({
      key: "chave-1",
      title: "Semana das crianças",
      theme,
      format: CATALOG_FORMATS.pdf,
      products: [product(1)],
    });

    expect(record).toMatchObject({
      clientKey: "chave-1",
      theme: 5,
      departmentId: 7,
      format: 3,
      title: "Semana das crianças",
    });
  });

  it("os produtos vão na ordem do desenho, com o papel em código e o preço IMPRESSO", () => {
    const record = toPieceRecord({
      key: "chave-1",
      title: "Destaques",
      theme,
      format: CATALOG_FORMATS.story,
      products: [
        // Oferta: o preço da peça é o promocional, e é ele que fica no histórico.
        product(3, { role: "offer", price: 7.5, referencePrice: 10 }),
        product(1, { role: "new" }),
        product(2, { role: "slow" }),
      ],
    });

    expect(record.items).toEqual([
      { productGroupId: 3, role: 1, price: 7.5 },
      { productGroupId: 1, role: 2, price: 10 },
      { productGroupId: 2, role: 5, price: 10 },
    ]);
  });

  it("tema fixo vai sem departamento", () => {
    const geral = { ...theme, key: "1", theme: 1, departmentId: undefined };
    const record = toPieceRecord({
      key: "k",
      title: "Destaques",
      theme: geral,
      format: CATALOG_FORMATS.feed,
      products: [product(1)],
    });

    expect(record.departmentId).toBeUndefined();
    expect(record.format).toBe(2);
  });
});

describe("newPieceKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cada peça tem a própria chave, dentro do limite do servidor (64)", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newPieceKey()));

    expect(keys.size).toBe(200);
    for (const key of keys) expect(key.length).toBeLessThanOrEqual(64);
  });

  it("sem `crypto.randomUUID` (http na rede da loja) ainda gera chave única", () => {
    vi.stubGlobal("crypto", {});

    const keys = new Set(Array.from({ length: 200 }, () => newPieceKey()));

    expect(keys.size).toBe(200);
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(10);
      expect(key.length).toBeLessThanOrEqual(64);
    }
  });
});
