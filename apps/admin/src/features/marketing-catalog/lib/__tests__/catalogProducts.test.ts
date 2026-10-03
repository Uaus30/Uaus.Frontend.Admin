import { describe, expect, it } from "vitest";
import type { CatalogItemDto, StorefrontProductDto } from "@workspace/api-client-react";
import { ROLE_CODE, toCatalogProduct, toCatalogProducts } from "../catalogProducts";

/**
 * Item sorteado como a API manda: campo nulo vem OMITIDO (`WhenWritingNull`) e
 * enum vem pelo NOME. O molde do teste omite e nomeia do mesmo jeito.
 */
function item(id: number, role: string, product: Partial<StorefrontProductDto> = {}): CatalogItemDto {
  return {
    role,
    product: {
      productGroupId: id,
      name: `PRODUTO ${id}`,
      price: 10,
      hasVariations: false,
      categoryName: "Cozinha",
      imageUrl: `https://bucket.exemplo/${id}.jpg`,
      tags: [],
      ...product,
    },
  };
}

describe("toCatalogProduct", () => {
  it("card sem foto não vira produto da peça", () => {
    expect(toCatalogProduct(item(1, "Regular", { imageUrl: undefined }))).toBeNull();
  });

  it("sem promoção vale o preço de tabela, sem selo", () => {
    expect(toCatalogProduct(item(1, "Regular"))).toEqual({
      productGroupId: 1,
      name: "PRODUTO 1",
      price: 10,
      hasPriceRange: false,
      referencePrice: undefined,
      imageUrl: "https://bucket.exemplo/1.jpg",
      role: "regular",
      badge: undefined,
    });
  });

  it("com promoção o preço é o promocional e o 'de' vem da API", () => {
    const product = toCatalogProduct(
      item(1, "Offer", { promotion: { type: "Flash", price: 7, referencePrice: 10 } }),
    );

    expect(product).toMatchObject({ price: 7, referencePrice: 10, role: "offer", badge: "offer" });
  });

  it("corte de até 5% vem sem 'de': o card mostra só o preço e o selo", () => {
    const product = toCatalogProduct(item(1, "Offer", { promotion: { type: "Everyday", price: 9.8 } }));

    expect(product).toMatchObject({ price: 9.8, badge: "offer" });
    expect(product?.referencePrice).toBeUndefined();
  });

  it("faixa de preço: a de tabela sem promoção, a promocional com ela", () => {
    expect(toCatalogProduct(item(1, "Regular", { priceMax: 18 }))?.hasPriceRange).toBe(true);
    // Com promoção de preço final as variações saem iguais: some o "a partir de".
    expect(
      toCatalogProduct(item(1, "Offer", { priceMax: 18, promotion: { type: "Flash", price: 7 } }))
        ?.hasPriceRange,
    ).toBe(false);
    expect(
      toCatalogProduct(item(1, "Offer", { promotion: { type: "Flash", price: 7, priceMax: 9 } }))
        ?.hasPriceRange,
    ).toBe(true);
  });

  it.each([
    ["Offer", "offer"],
    ["New", "new"],
    ["BestSeller", "bestSeller"],
    ["Regular", "regular"],
    ["Slow", "slow"],
  ])("o papel %s da API vira %s na tela", (fromApi, onScreen) => {
    expect(toCatalogProduct(item(1, fromApi))?.role).toBe(onScreen);
  });

  it("papel que a tela não conhece cai em intermediário, em vez de sumir com o produto", () => {
    expect(toCatalogProduct(item(1, "Futuro"))?.role).toBe("regular");
  });

  it("o papel também chega como número, se a serialização mudar", () => {
    expect(toCatalogProduct({ ...item(1, "x"), role: 2 })?.role).toBe("new");
  });

  it("novidade ganha o selo de novidade", () => {
    expect(toCatalogProduct(item(1, "New"))?.badge).toBe("new");
  });

  it("um selo só: a oferta vence a novidade, que vence a escassez", () => {
    const promotion = { type: "Flash", price: 7 };

    expect(toCatalogProduct(item(1, "New", { promotion, stockBadge: "LastUnits" }))?.badge).toBe("offer");
    expect(toCatalogProduct(item(1, "New", { stockBadge: "LastUnits" }))?.badge).toBe("new");
    expect(toCatalogProduct(item(1, "Slow", { stockBadge: "LastUnits" }))?.badge).toBe("lastUnits");
    expect(toCatalogProduct(item(1, "Slow", { stockBadge: "LastUnit" }))?.badge).toBe("lastUnits");
    expect(toCatalogProduct(item(1, "Slow", { stockBadge: "None" }))?.badge).toBeUndefined();
  });

  it("o card diz oferta mesmo que o sorteio tenha dado outro papel", () => {
    // A promoção começou entre o sorteio e a montagem do card: quem decide o
    // selo é o preço impresso, e não o papel.
    const product = toCatalogProduct(item(1, "BestSeller", { promotion: { type: "Flash", price: 7 } }));

    expect(product?.badge).toBe("offer");
  });
});

describe("toCatalogProducts", () => {
  it("mantém a ordem do sorteio e tira o card sem foto", () => {
    const products = toCatalogProducts([
      item(3, "Offer"),
      item(1, "New", { imageUrl: undefined }),
      item(2, "Slow"),
    ]);

    expect(products.map((product) => product.productGroupId)).toEqual([3, 2]);
  });
});

describe("ROLE_CODE", () => {
  it("devolve ao servidor o código do papel, para a troca manter a mistura", () => {
    expect(ROLE_CODE).toEqual({ offer: 1, new: 2, bestSeller: 3, regular: 4, slow: 5 });
  });
});
