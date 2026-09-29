import { describe, expect, it } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, type PromotionDto } from "@workspace/api-client-react";
import {
  buildPromotionPayload,
  describeFormProblem,
  emptyPromotionForm,
  formFromPromotion,
  repeatFormFromPromotion,
  switchPromotionType,
} from "../promotionRules";
import type { PromotionForm } from "../../types";

/**
 * O combo no formulário: "3 esmaltes Risqué ou Impala por R$ 20".
 *
 * O que está sendo protegido é o que a troca de tipo limpa (limite, meta e preço
 * do kit não podem sobrar gravados onde o servidor os recusa) e o payload que a
 * API espera — a lista de grupos, a quantidade e a capa no `productGroupId`.
 */

const hoje = new Date(2026, 8, 29);
const RISQUE = { id: 846, name: "ESMALTE RISQUÉ" };
const IMPALA = { id: 834, name: "ESMALTE IMPALA" };

function combo(parcial: Partial<PromotionForm> = {}): PromotionForm {
  return {
    ...emptyPromotionForm(hoje),
    type: PROMOTION_TYPE.Combo,
    discountType: PROMOTION_DISCOUNT_TYPE.KitPrice,
    discountValue: "20,00",
    comboGroups: [RISQUE, IMPALA],
    comboQuantity: "3",
    ...parcial,
  };
}

describe("troca de tipo", () => {
  it("entrar no combo leva o produto escolhido para a lista, propõe o kit e limpa limite e meta", () => {
    const diaADia: PromotionForm = {
      ...emptyPromotionForm(hoje),
      productGroupId: RISQUE.id,
      productGroupName: RISQUE.name,
      maxQuantityPerSale: "6",
      targetQuantity: "60",
    };

    const trocado = switchPromotionType(diaADia, PROMOTION_TYPE.Combo);

    expect(trocado.comboGroups).toEqual([RISQUE]);
    expect(trocado.discountType).toBe(PROMOTION_DISCOUNT_TYPE.KitPrice);
    expect(trocado.maxQuantityPerSale).toBe("");
    expect(trocado.targetQuantity).toBe("");
  });

  it("sair do combo volta ao percentual e traz o primeiro produto da lista", () => {
    const trocado = switchPromotionType(combo(), PROMOTION_TYPE.Everyday);

    expect(trocado.discountType).toBe(PROMOTION_DISCOUNT_TYPE.Percentage);
    expect(trocado.productGroupId).toBe(RISQUE.id);
    expect(trocado.comboGroups).toEqual([]);
  });

  it("a relâmpago continua limpando banner e horário na saída", () => {
    const relampago: PromotionForm = {
      ...emptyPromotionForm(hoje),
      type: PROMOTION_TYPE.Flash,
      showOnSite: true,
      startTime: "14:00",
      endTime: "18:00",
    };

    const trocado = switchPromotionType(relampago, PROMOTION_TYPE.Combo);

    expect(trocado.showOnSite).toBe(false);
    expect(trocado.startTime).toBe("00:00");
    expect(trocado.endTime).toBe("23:59");
  });
});

describe("validação do combo", () => {
  it("aceita o cartaz do dono", () => {
    expect(describeFormProblem(combo(), { isNew: true, now: hoje })).toBeNull();
  });

  it("cobra pelo menos um produto, sem cobrar o produto único das outras espécies", () => {
    expect(describeFormProblem(combo({ comboGroups: [] }), { isNew: true, now: hoje })).toBe(
      "Escolha pelo menos um produto para o combo.",
    );
  });

  it.each(["", "1", "100", "2,5", "três"])("recusa a quantidade %j", (quantidade) => {
    expect(describeFormProblem(combo({ comboQuantity: quantidade }), { isNew: true, now: hoje })).toBe(
      "A quantidade do combo tem que ficar entre 2 e 99 itens.",
    );
  });

  it("recusa desconto zero, como a relâmpago", () => {
    const partir = combo({ discountType: PROMOTION_DISCOUNT_TYPE.Percentage, discountValue: "0" });

    expect(describeFormProblem(partir, { isNew: true, now: hoje })).toBe(
      "Um combo precisa de um desconto maior que zero.",
    );
  });
});

describe("payload do combo", () => {
  it("manda a lista, a quantidade e a capa, sem limite nem meta", () => {
    const payload = buildPromotionPayload(combo({ maxQuantityPerSale: "6", productGroupId: 999 }));

    expect(payload).toMatchObject({
      productGroupId: RISQUE.id,
      productGroupIds: [RISQUE.id, IMPALA.id],
      comboQuantity: 3,
      type: PROMOTION_TYPE.Combo,
      discountType: PROMOTION_DISCOUNT_TYPE.KitPrice,
      discountValue: 20,
      maxQuantityPerSale: null,
      targetQuantity: null,
      showOnSite: false,
    });
  });

  it("fora do combo não manda lista nem quantidade", () => {
    const payload = buildPromotionPayload({
      ...emptyPromotionForm(hoje),
      productGroupId: RISQUE.id,
      discountValue: "10",
      comboQuantity: "3",
    });

    expect(payload.productGroupIds).toEqual([]);
    expect(payload.comboQuantity).toBeNull();
  });
});

describe("combo gravado", () => {
  const gravado: PromotionDto = {
    id: 9,
    createdAt: "2026-09-29T08:00:00",
    productGroupId: RISQUE.id,
    productGroupName: "ESMALTE RISQUÉ + ESMALTE IMPALA",
    type: "Combo",
    discountType: "KitPrice",
    discountValue: 20,
    validFrom: "2026-09-29T00:00:00",
    comboQuantity: 3,
    comboGroups: [
      { productGroupId: RISQUE.id, name: RISQUE.name },
      { productGroupId: IMPALA.id, name: IMPALA.name },
    ],
    isActive: true,
    showOnSite: false,
    investment: 0,
    referencePriceMin: 7,
    referencePriceMax: 7,
    promotionalPriceMin: 6.67,
    promotionalPriceMax: 6.67,
  };

  it("volta ao formulário com os produtos e a quantidade", () => {
    const form = formFromPromotion(gravado);

    expect(form.type).toBe(PROMOTION_TYPE.Combo);
    expect(form.discountType).toBe(PROMOTION_DISCOUNT_TYPE.KitPrice);
    expect(form.comboGroups).toEqual([RISQUE, IMPALA]);
    expect(form.comboQuantity).toBe("3");
  });

  it("repetir copia os produtos e começa hoje, sem prazo", () => {
    const form = repeatFormFromPromotion(gravado, hoje);

    expect(form.comboGroups).toEqual([RISQUE, IMPALA]);
    expect(form.noEndDate).toBe(true);
  });
});
