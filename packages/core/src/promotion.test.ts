import { describe, expect, it } from "vitest";
import {
  describeComboOffer,
  isPromotionInWindow,
  promotionalUnitPrice,
  promotionDiscountKindFromCode,
  promotionKindFromCode,
  resolveShelfPromotion,
  shelfPrice,
  type PromotionRule,
} from "./promotion";
import { toLocalTimestamp } from "./format";

/** Regra mínima: Dia a Dia de 10% no grupo 7, sem prazo. */
function rule(overrides: Partial<PromotionRule> = {}): PromotionRule {
  return {
    id: 1,
    kind: "everyday",
    discountKind: "percentage",
    discountValue: 10,
    productGroupIds: [7],
    comboQuantity: null,
    validFrom: "2026-10-01T00:00:00",
    validUntil: null,
    maxQuantityPerSale: null,
    ...overrides,
  };
}

const AGORA = "2026-10-11T14:00:00";

/** O `Intl` separa "R$" do número com espaço inquebrável; o teste escreve com espaço comum. */
const brl = (texto: string) => texto.split("R$ ").join(`R$${String.fromCharCode(160)}`);

describe("códigos do enum", () => {
  it("traduz os códigos da API e recusa o desconhecido", () => {
    expect([1, 2, 3, 0].map(promotionKindFromCode)).toEqual(["everyday", "flash", "combo", null]);
    expect([1, 2, 3, 9].map(promotionDiscountKindFromCode)).toEqual([
      "percentage",
      "finalPrice",
      "kitPrice",
      null,
    ]);
  });
});

describe("promotionalUnitPrice", () => {
  it("arredonda por unidade, como o backend", () => {
    // R$ 12,49 com 30% = 8,743 → 8,74 (e não a metade de um total arredondado).
    expect(promotionalUnitPrice(12.49, "percentage", 30)).toBe(8.74);
  });

  it("preço final vale para qualquer variação, e nunca fica negativo", () => {
    expect(promotionalUnitPrice(15, "finalPrice", 9.9)).toBe(9.9);
    expect(promotionalUnitPrice(15, "finalPrice", -1)).toBe(0);
  });

  it("o preço do kit não é preço de unidade", () => {
    expect(promotionalUnitPrice(7, "kitPrice", 20)).toBe(7);
  });
});

describe("isPromotionInWindow", () => {
  it("as duas pontas são inclusivas", () => {
    const relampago = { validFrom: "2026-10-11T08:00:00", validUntil: "2026-10-11T18:00:00" };
    expect(isPromotionInWindow(relampago, "2026-10-11T08:00:00")).toBe(true);
    expect(isPromotionInWindow(relampago, "2026-10-11T18:00:00")).toBe(true);
    expect(isPromotionInWindow(relampago, "2026-10-11T18:00:01")).toBe(false);
    expect(isPromotionInWindow(relampago, "2026-10-11T07:59:59")).toBe(false);
  });

  it("fim nulo é sem prazo", () => {
    expect(
      isPromotionInWindow({ validFrom: "2026-01-01T00:00:00", validUntil: null }, "2030-01-01T00:00:00"),
    ).toBe(true);
  });

  it("compara no formato de toLocalTimestamp, sem fuso", () => {
    // 17h34 local não pode virar 20h34 (UTC) — o caso que o `toISOString` estragava.
    const instante = toLocalTimestamp(new Date(2026, 9, 11, 17, 34, 12));
    expect(instante).toBe("2026-10-11T17:34:12");
    expect(
      isPromotionInWindow({ validFrom: "2026-10-11T17:00:00", validUntil: "2026-10-11T18:00:00" }, instante),
    ).toBe(true);
  });
});

describe("resolveShelfPromotion", () => {
  const diaADia = rule({ id: 1, kind: "everyday" });
  const relampago = rule({
    id: 2,
    kind: "flash",
    discountKind: "finalPrice",
    discountValue: 5,
    validFrom: "2026-10-11T08:00:00",
    validUntil: "2026-10-11T18:00:00",
  });
  const combo = rule({ id: 3, kind: "combo", discountKind: "kitPrice", discountValue: 20, comboQuantity: 3 });

  it("relâmpago vence combo e Dia a Dia enquanto dura", () => {
    expect(resolveShelfPromotion([diaADia, combo, relampago], 7, AGORA)?.id).toBe(2);
    expect(resolveShelfPromotion([diaADia, combo, relampago], 7, "2026-10-11T19:00:00")?.id).toBe(3);
  });

  it("combo vence Dia a Dia, como no carrinho", () => {
    expect(resolveShelfPromotion([diaADia, combo], 7, AGORA)?.id).toBe(3);
  });

  it("o combo alcança todos os grupos dele, não só a capa", () => {
    const doisGrupos = rule({ ...combo, productGroupIds: [7, 8] });
    expect(resolveShelfPromotion([doisGrupos], 8, AGORA)?.id).toBe(3);
  });

  it("ignora combo sem quantidade, promoção fora da janela e grupo ausente", () => {
    const comboTorto = rule({ ...combo, comboQuantity: 1 });
    const futura = rule({ validFrom: "2026-10-12T00:00:00" });
    expect(resolveShelfPromotion([comboTorto, futura], 7, AGORA)).toBeNull();
    expect(resolveShelfPromotion([diaADia], 99, AGORA)).toBeNull();
    expect(resolveShelfPromotion([diaADia], null, AGORA)).toBeNull();
    expect(resolveShelfPromotion([diaADia], 0, AGORA)).toBeNull();
  });
});

describe("shelfPrice", () => {
  it("sem promoção é o preço de tabela", () => {
    expect(shelfPrice(12.9, null)).toEqual({ kind: "regular", price: 12.9 });
  });

  it("relâmpago e Dia a Dia trocam o preço e guardam o de tabela", () => {
    const resultado = shelfPrice(
      12.9,
      rule({ kind: "flash", discountKind: "finalPrice", discountValue: 9.9 }),
    );
    expect(resultado).toMatchObject({ kind: "unit", price: 9.9, referencePrice: 12.9 });
  });

  it("a isca de percentual zero continua promoção, sem diferença de preço", () => {
    expect(shelfPrice(2, rule({ discountValue: 0 }))).toMatchObject({
      kind: "unit",
      price: 2,
      referencePrice: 2,
    });
  });

  it("preço promocional acima do de tabela não é anunciado", () => {
    // Preço final de R$ 15 cadastrado quando o produto custava R$ 20, e o preço
    // baixou para R$ 12 depois: o "desconto" subiria o preço.
    expect(shelfPrice(12, rule({ discountKind: "finalPrice", discountValue: 15 }))).toEqual({
      kind: "regular",
      price: 12,
    });
  });

  it("combo mantém o preço normal e resume a oferta no selo", () => {
    const kit = rule({ kind: "combo", discountKind: "kitPrice", discountValue: 20, comboQuantity: 3 });
    expect(shelfPrice(7, kit)).toMatchObject({ kind: "combo", price: 7, offer: brl("3 por R$ 20,00") });

    const aPartirDe = rule({
      kind: "combo",
      discountKind: "finalPrice",
      discountValue: 6.5,
      comboQuantity: 2,
    });
    expect(shelfPrice(7, aPartirDe)).toMatchObject({ kind: "combo", price: 7, offer: brl("R$ 6,50 pra 2+") });
  });

  it("combo que não barateia a unidade não ganha selo", () => {
    // "3 por R$ 20" num produto de R$ 5: três avulsos custam R$ 15.
    const kit = rule({ kind: "combo", discountKind: "kitPrice", discountValue: 20, comboQuantity: 3 });
    expect(shelfPrice(5, kit)).toEqual({ kind: "regular", price: 5 });
  });
});

describe("describeComboOffer", () => {
  it("no percentual, com o preço, diz o preço por unidade", () => {
    expect(describeComboOffer({ quantity: 3, discountKind: "percentage", discountValue: 10 }, 7)).toBe(
      brl("R$ 6,30 pra 3+"),
    );
  });

  it("no percentual, sem o preço, fica o percentual", () => {
    expect(describeComboOffer({ quantity: 3, discountKind: "percentage", discountValue: 12.5 })).toBe(
      "12,5% off pra 3+",
    );
  });
});
