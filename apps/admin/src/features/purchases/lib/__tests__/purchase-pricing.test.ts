import { describe, expect, it } from "vitest";
import { defaultSuggestedPrice, variationPricesDiffer } from "../purchase-pricing";

describe("defaultSuggestedPrice", () => {
  it("reposição nasce com o preço ATUAL do produto, e não com a margem sobre o custo", () => {
    expect(
      defaultSuggestedPrice({ hasProduct: true, productPrice: 12.9, groupPrices: [], unitCost: 10 }),
    ).toBe(12.9);
  });

  it("variações com o mesmo preço: esse preço", () => {
    expect(
      defaultSuggestedPrice({ hasProduct: true, productPrice: 20, groupPrices: [20, 20], unitCost: 8 }),
    ).toBe(20);
  });

  it("variações com preços diferentes nascem em branco — cada uma mantém o seu no recebimento", () => {
    expect(
      defaultSuggestedPrice({ hasProduct: true, productPrice: 20, groupPrices: [20, 25], unitCost: 8 }),
    ).toBe(0);
  });

  it("produto novo segue a margem de 40% sobre o custo", () => {
    expect(
      defaultSuggestedPrice({ hasProduct: false, productPrice: null, groupPrices: [], unitCost: 8.9 }),
    ).toBe(14.9);
  });

  it("nunca passa do teto da loja", () => {
    expect(
      defaultSuggestedPrice({ hasProduct: false, productPrice: null, groupPrices: [], unitCost: 20 }),
    ).toBe(30);
    expect(defaultSuggestedPrice({ hasProduct: true, productPrice: 35, groupPrices: [], unitCost: 20 })).toBe(
      30,
    );
  });

  it("sem custo e sem preço, em branco", () => {
    expect(
      defaultSuggestedPrice({ hasProduct: false, productPrice: null, groupPrices: [], unitCost: 0 }),
    ).toBe(0);
    expect(
      defaultSuggestedPrice({ hasProduct: true, productPrice: null, groupPrices: [], unitCost: 0 }),
    ).toBe(0);
  });
});

describe("variationPricesDiffer", () => {
  it("compara só os preços informados", () => {
    expect(variationPricesDiffer([20, 25])).toBe(true);
    expect(variationPricesDiffer([20, 20, 0])).toBe(false);
    expect(variationPricesDiffer([])).toBe(false);
  });
});
