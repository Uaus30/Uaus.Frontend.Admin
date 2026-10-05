import { describe, expect, it } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, type PdvPromotionDto } from "@workspace/api-client-react";
import { promotionDiscountKindFromCode, promotionKindFromCode } from "@workspace/core";
import { toPromotionRule } from "../use-shelf-price";

const BASE: PdvPromotionDto = {
  id: 9,
  productGroupId: 41,
  type: "Flash",
  discountType: "Percentage",
  discountValue: 20,
  validFrom: "2026-10-11T08:00:00",
  validUntil: "2026-10-11T18:00:00",
};

describe("toPromotionRule", () => {
  it("os códigos que o core conhece são os do api-client", () => {
    // O core não pode importar o api-client; este teste é a amarra entre os dois.
    expect(promotionKindFromCode(PROMOTION_TYPE.Everyday)).toBe("everyday");
    expect(promotionKindFromCode(PROMOTION_TYPE.Flash)).toBe("flash");
    expect(promotionKindFromCode(PROMOTION_TYPE.Combo)).toBe("combo");
    expect(promotionDiscountKindFromCode(PROMOTION_DISCOUNT_TYPE.Percentage)).toBe("percentage");
    expect(promotionDiscountKindFromCode(PROMOTION_DISCOUNT_TYPE.FinalPrice)).toBe("finalPrice");
    expect(promotionDiscountKindFromCode(PROMOTION_DISCOUNT_TYPE.KitPrice)).toBe("kitPrice");
  });

  it("lê o enum pelo nome, como a API manda, e omite o que vem ausente", () => {
    expect(toPromotionRule(BASE)).toEqual({
      id: 9,
      kind: "flash",
      discountKind: "percentage",
      discountValue: 20,
      productGroupIds: [41],
      comboQuantity: null,
      validFrom: "2026-10-11T08:00:00",
      validUntil: "2026-10-11T18:00:00",
      maxQuantityPerSale: null,
    });
  });

  it("no combo, os grupos vêm da lista — o productGroupId é zero", () => {
    const combo = toPromotionRule({
      ...BASE,
      productGroupId: 0,
      productGroupIds: [41, 42],
      type: PROMOTION_TYPE.Combo,
      discountType: PROMOTION_DISCOUNT_TYPE.KitPrice,
      comboQuantity: 3,
    });
    expect(combo?.productGroupIds).toEqual([41, 42]);
    expect(combo?.comboQuantity).toBe(3);
  });

  it("promoção de espécie desconhecida não vira regra", () => {
    expect(toPromotionRule({ ...BASE, type: "None" })).toBeNull();
  });
});
