import { describe, expect, it } from "vitest";
import type { CatalogSpotlightDto, StorefrontProductDto } from "@workspace/api-client-react";
import {
  kindStates,
  limitNote,
  noveltyHint,
  promotionNotes,
  smallPhotoHint,
  spotlightBlocker,
  suggestedKind,
  toSpotlightProduct,
  validityNote,
} from "../spotlight";

/** Meio-dia de Brasília de 04/11/2026: longe da virada do dia. */
const TODAY = new Date("2026-11-04T15:00:00Z");

function card(overrides: Partial<StorefrontProductDto> = {}): StorefrontProductDto {
  return {
    productGroupId: 7,
    name: "GARRAFA TÉRMICA 500ML",
    price: 24.9,
    hasVariations: false,
    categoryName: "Cozinha",
    imageUrl: "/img/7.jpg",
    tags: [],
    ...overrides,
  };
}

function spotlight(overrides: Partial<CatalogSpotlightDto> = {}): CatalogSpotlightDto {
  return {
    productGroupId: 7,
    name: "GARRAFA TÉRMICA 500ML",
    unavailable: "None",
    card: card(),
    daysInStore: 200,
    isNew: false,
    isRestock: false,
    ...overrides,
  };
}

const PROMO = { type: "Everyday", price: 19.9, referencePrice: 24.9 };

describe("tipo sugerido e o que cada tipo pode", () => {
  it("a promoção vence; depois a novidade; depois a reposição; sem nada, a novidade", () => {
    expect(suggestedKind(spotlight({ card: card({ promotion: PROMO }), isNew: true }))).toBe("offer");
    expect(suggestedKind(spotlight({ isNew: true, isRestock: false }))).toBe("new");
    expect(suggestedKind(spotlight({ isRestock: true }))).toBe("restock");
    expect(suggestedKind(spotlight())).toBe("new");
  });

  it("o combo também é promoção", () => {
    const combo = card({ combo: { quantity: 3, discountType: "KitPrice", discountValue: 20 } });
    expect(suggestedKind(spotlight({ card: combo }))).toBe("offer");
  });

  it("só o promocional trava, e só sem promoção", () => {
    const states = kindStates(spotlight({ isRestock: true }));

    expect(states.offer).toEqual({ enabled: false, suggested: false, reason: "sem promoção ativa" });
    expect(states.new.enabled).toBe(true);
    expect(states.restock).toEqual({ enabled: true, suggested: true });
  });

  it("antes da primeira consulta nada trava: quem escolheu o tipo foi o menu", () => {
    const states = kindStates(null);

    expect(Object.values(states).every((state) => state.enabled && !state.suggested)).toBe(true);
  });

  it("a novidade fora da janela avisa os dias na loja, sem travar", () => {
    expect(noveltyHint(spotlight({ daysInStore: 210 }), "new")).toBe(
      "Na loja há 210 dias — fora da janela de novidade do catálogo (30 dias).",
    );
    expect(noveltyHint(spotlight({ daysInStore: 10, isNew: true }), "new")).toBeNull();
    expect(noveltyHint(spotlight({ daysInStore: 210 }), "restock")).toBeNull();
    expect(noveltyHint(null, "new")).toBeNull();
  });
});

describe("validade e limite da promoção", () => {
  it("o dia vem do texto da API, sem fuso: 23:59 do dia 8 continua sendo dia 8", () => {
    expect(validityNote("2026-11-08T23:59:59", TODAY)).toBe("Válida até 08/11");
  });

  it("termina hoje: 'Só hoje'; já terminou ou sem data: nada", () => {
    expect(validityNote("2026-11-04T18:00:00", TODAY)).toBe("Só hoje");
    expect(validityNote("2026-11-03T23:59:59", TODAY)).toBeNull();
    expect(validityNote(null, TODAY)).toBeNull();
    expect(validityNote("lixo", TODAY)).toBeNull();
  });

  it("de outro ano, o ano vai junto", () => {
    expect(validityNote("2027-01-10T23:59:59", TODAY)).toBe("Válida até 10/01/2027");
  });

  it("o hoje é o da LOJA: às 22h de Brasília do dia 4 ainda é dia 4", () => {
    // 01:00 UTC do dia 5 = 22:00 do dia 4 em Brasília.
    expect(validityNote("2026-11-04T23:59:59", new Date("2026-11-05T01:00:00Z"))).toBe("Só hoje");
  });

  it("limite só quando existe", () => {
    expect(limitNote(3)).toBe("Limite de 3 por cliente");
    expect(limitNote(null)).toBeNull();
    expect(limitNote(0)).toBeNull();
  });

  it("as linhas acompanham o preço impresso: a promoção de unidade em qualquer tipo, o combo só no promocional", () => {
    const unidade = card({
      promotion: { ...PROMO, validUntil: "2026-11-08T23:59:59", maxQuantityPerSale: 3 },
    });
    const combo = card({
      combo: { quantity: 3, discountType: "KitPrice", discountValue: 20, validUntil: "2026-11-08T23:59:59" },
    });

    expect(promotionNotes(unidade, "offer", TODAY)).toEqual(["Válida até 08/11", "Limite de 3 por cliente"]);
    expect(promotionNotes(unidade, "new", TODAY)).toEqual(["Válida até 08/11", "Limite de 3 por cliente"]);
    expect(promotionNotes(combo, "offer", TODAY)).toEqual(["Válida até 08/11"]);
    expect(promotionNotes(combo, "new", TODAY)).toEqual([]);
    expect(promotionNotes(card(), "offer", TODAY)).toEqual([]);
  });
});

describe("o produto do banner", () => {
  it("vai com o papel do tipo e o preço promocional com o 'de'", () => {
    const product = toSpotlightProduct(card({ promotion: PROMO }), "restock", "");

    expect(product).toMatchObject({
      role: "restock",
      price: 19.9,
      referencePrice: 24.9,
      name: "GARRAFA TÉRMICA 500ML",
    });
  });

  it("o nome reescrito vale só no banner; em branco volta o do cadastro", () => {
    expect(toSpotlightProduct(card(), "new", "  Garrafa   inox ")!.name).toBe("Garrafa inox");
    expect(toSpotlightProduct(card(), "new", "   ")!.name).toBe("GARRAFA TÉRMICA 500ML");
  });

  it("sem foto não há banner", () => {
    expect(toSpotlightProduct(card({ imageUrl: null }), "new", "")).toBeNull();
  });
});

describe("o que impede gerar", () => {
  it("produto que não pode entrar diz o motivo", () => {
    expect(spotlightBlocker(spotlight({ unavailable: "OutOfStock", card: null }), "new")).toBe(
      "GARRAFA TÉRMICA 500ML não pode sair no banner: sem saldo.",
    );
  });

  it("promocional sem promoção valendo não sai: o selo mentiria sobre o preço", () => {
    expect(spotlightBlocker(spotlight(), "offer")).toMatch(/não está valendo/);
    expect(spotlightBlocker(spotlight(), "new")).toBeNull();
    expect(spotlightBlocker(spotlight({ card: card({ promotion: PROMO }) }), "offer")).toBeNull();
  });
});

describe("foto pequena", () => {
  it("avisa abaixo de 300 px no menor lado, sem travar", () => {
    expect(smallPhotoHint({ width: 225, height: 400 })).toMatch(/pequena \(225 px\)/);
    expect(smallPhotoHint({ width: 300, height: 300 })).toBeNull();
    expect(smallPhotoHint(undefined)).toBeNull();
    expect(smallPhotoHint({ width: 0, height: 0 })).toBeNull();
  });
});
