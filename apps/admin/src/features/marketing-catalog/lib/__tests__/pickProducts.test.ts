import { describe, expect, it } from "vitest";
import type { StorefrontProductDto } from "@workspace/api-client-react";
import { createSeededRandom, pickStoryProducts, shuffle, toCatalogProduct } from "../pickProducts";

/**
 * Card da vitrine como a API manda: campo nulo vem OMITIDO (`WhenWritingNull`),
 * então o molde do teste omite também em vez de escrever `null`.
 */
function item(id: number, overrides: Partial<StorefrontProductDto> = {}): StorefrontProductDto {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasVariations: false,
    categoryName: "Cozinha",
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    tags: [],
    ...overrides,
  };
}

const offer = (id: number): StorefrontProductDto =>
  item(id, { promotion: { type: "Flash", price: 7, referencePrice: 10 } });

describe("toCatalogProduct", () => {
  it("produto sem foto não vira card", () => {
    expect(toCatalogProduct(item(1, { imageUrl: undefined }))).toBeNull();
  });

  it("sem promoção vale o preço de tabela, sem selo", () => {
    expect(toCatalogProduct(item(1))).toEqual({
      productGroupId: 1,
      name: "PRODUTO 1",
      price: 10,
      hasPriceRange: false,
      referencePrice: undefined,
      imageUrl: "https://bucket.exemplo/1.jpg",
      badge: undefined,
    });
  });

  it("com promoção o preço é o promocional e o 'de' vem da API", () => {
    expect(toCatalogProduct(offer(1))).toMatchObject({ price: 7, referencePrice: 10, badge: "offer" });
  });

  it("corte de até 5% vem sem 'de': o card mostra só o preço e o selo", () => {
    const product = toCatalogProduct(item(1, { promotion: { type: "Everyday", price: 9.8 } }));

    expect(product).toMatchObject({ price: 9.8, badge: "offer" });
    expect(product?.referencePrice).toBeUndefined();
  });

  it("faixa de preço: a de tabela sem promoção, a promocional com ela", () => {
    expect(toCatalogProduct(item(1, { priceMax: 18 }))?.hasPriceRange).toBe(true);
    // Com promoção de preço final as variações saem iguais: some o "a partir de".
    expect(
      toCatalogProduct(item(1, { priceMax: 18, promotion: { type: "Flash", price: 7 } }))?.hasPriceRange,
    ).toBe(false);
    expect(
      toCatalogProduct(item(1, { promotion: { type: "Flash", price: 7, priceMax: 9 } }))?.hasPriceRange,
    ).toBe(true);
  });

  it("a tag de escassez chega como NOME do enum e vira selo", () => {
    expect(toCatalogProduct(item(1, { stockBadge: "LastUnits" }))?.badge).toBe("lastUnits");
    expect(toCatalogProduct(item(1, { stockBadge: "LastUnit" }))?.badge).toBe("lastUnits");
    expect(toCatalogProduct(item(1, { stockBadge: "None" }))?.badge).toBeUndefined();
  });

  it("a oferta vence a escassez: um selo só por card", () => {
    expect(toCatalogProduct({ ...offer(1), stockBadge: "LastUnits" })?.badge).toBe("offer");
  });
});

describe("sorteio", () => {
  it("a mesma semente dá a mesma ordem; sementes diferentes, ordens diferentes", () => {
    const items = Array.from({ length: 30 }, (_, index) => index);

    expect(shuffle(items, createSeededRandom(7))).toEqual(shuffle(items, createSeededRandom(7)));
    expect(shuffle(items, createSeededRandom(7))).not.toEqual(shuffle(items, createSeededRandom(8)));
  });

  it("embaralhar não perde nem repete item, e não mexe na lista original", () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = shuffle(items, createSeededRandom(3));

    expect([...result].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("pickStoryProducts", () => {
  const random = () => createSeededRandom(42);

  it("as ofertas vêm primeiro e ocupam no máximo um terço do banner", () => {
    const items = [
      ...[1, 2, 3, 4, 5, 6].map(offer),
      ...Array.from({ length: 20 }, (_, index) => item(100 + index)),
    ];

    const picked = pickStoryProducts(items, 9, random());

    expect(picked).toHaveLength(9);
    expect(picked.slice(0, 3).every((product) => product.badge === "offer")).toBe(true);
    expect(picked.slice(3).every((product) => product.badge !== "offer")).toBe(true);
  });

  it("faltando produto sem oferta, as ofertas que sobraram completam", () => {
    const items = [...[1, 2, 3, 4, 5, 6].map(offer), item(100), item(101)];

    const picked = pickStoryProducts(items, 9, random());

    expect(picked).toHaveLength(8);
    expect(picked.filter((product) => product.badge === "offer")).toHaveLength(6);
  });

  it("a folga não entra na conta do teto: 9 no banner são 3 ofertas, não 4", () => {
    // Somando a folga ao tamanho do banner, um terço de 13 dava 4 ofertas em 9.
    const items = [
      ...[1, 2, 3, 4, 5, 6].map(offer),
      ...Array.from({ length: 20 }, (_, index) => item(100 + index)),
    ];

    const picked = pickStoryProducts(items, 9, random(), 4);

    expect(picked).toHaveLength(13);
    expect(picked.slice(0, 9).filter((product) => product.badge === "offer")).toHaveLength(3);
    // As reservas são produtos sem oferta: quem cede a vaga não aumenta o teto.
    expect(picked.slice(9).every((product) => product.badge !== "offer")).toBe(true);
  });

  it("sem produto comum para reserva, as ofertas que sobraram ficam de reserva", () => {
    const items = [...[1, 2, 3, 4, 5].map(offer), ...[100, 101, 102, 103, 104, 105].map((id) => item(id))];

    const picked = pickStoryProducts(items, 9, random(), 4);

    expect(picked).toHaveLength(11);
    expect(picked.slice(0, 9).filter((product) => product.badge === "offer")).toHaveLength(3);
    expect(picked.slice(9).every((product) => product.badge === "offer")).toBe(true);
  });

  it("as reservas não repetem quem já está no banner", () => {
    const items = Array.from({ length: 30 }, (_, index) => item(index + 1));

    const ids = pickStoryProducts(items, 9, random(), 4).map((product) => product.productGroupId);

    expect(new Set(ids).size).toBe(13);
  });

  it("produto sem foto fica de fora do sorteio", () => {
    const items = [item(1), item(2, { imageUrl: undefined }), item(3)];

    const ids = pickStoryProducts(items, 9, random()).map((product) => product.productGroupId);

    expect(ids.sort()).toEqual([1, 3]);
  });

  it("não repete produto", () => {
    const items = Array.from({ length: 12 }, (_, index) => item(index + 1));

    const ids = pickStoryProducts(items, 9, random()).map((product) => product.productGroupId);

    expect(new Set(ids).size).toBe(9);
  });

  it("vitrine vazia devolve lista vazia", () => {
    expect(pickStoryProducts([], 9, random())).toEqual([]);
  });
});
