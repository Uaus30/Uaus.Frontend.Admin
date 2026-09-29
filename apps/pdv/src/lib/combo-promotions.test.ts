import { describe, expect, it } from "vitest";
import { round2 } from "@workspace/core";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE } from "@workspace/api-client-react";
import type { LocalPromotion } from "@/offline";
import type { PdvItem } from "@/stores/pdv-cart";
import {
  allocateCombo,
  coveredGroupIds,
  describeComboOffer,
  missingForCombo,
  resolveCombo,
} from "./combo-promotions";
import { applyPromotionsToCart, describePromotions, resolvePromotion } from "./promotions";

/**
 * O combo no carrinho: "3 esmaltes Risqué ou Impala por R$ 20".
 *
 * O que estes testes protegem é o total que o cliente paga — o kit fecha no
 * centavo, a sobra sai a preço normal — e a mesma conta que o servidor refaz em
 * `PromotionRules.ComboDiscount`. Instante fixo, como em `promotions.test.ts`.
 */

const DENTRO = "2026-09-19T14:00:00";
const RISQUE = 846;
const IMPALA = 834;

function combo(overrides: Partial<LocalPromotion> = {}): LocalPromotion {
  return {
    id: 40,
    productGroupId: RISQUE,
    productGroupIds: [RISQUE, IMPALA],
    comboQuantity: 3,
    type: PROMOTION_TYPE.Combo,
    discountType: PROMOTION_DISCOUNT_TYPE.KitPrice,
    discountValue: 20,
    validFrom: "2026-09-01T00:00:00",
    validUntil: null,
    maxQuantityPerSale: null,
    ...overrides,
  };
}

function esmalte(overrides: Partial<PdvItem> = {}): PdvItem {
  return {
    id: "risque",
    productId: 1,
    productGroupId: RISQUE,
    name: "ESMALTE RISQUÉ",
    price: 7,
    quantity: 1,
    discount: 0,
    availableStock: 50,
    ...overrides,
  };
}

/** O que o cliente paga pelas linhas que o pagamento recebe. */
function totalPago(linhas: PdvItem[]): number {
  return round2(linhas.reduce((soma, linha) => soma + linha.quantity * (linha.price - linha.discount), 0));
}

describe("allocateCombo — preço do kit", () => {
  const umaUnidade = () => 0;

  it("fecha o kit no centavo: três de R$ 7,00 por R$ 20,00 é R$ 1,00 em 33 + 33 + 34 centavos", () => {
    const alocacao = allocateCombo([{ index: 0, listPrice: 7, quantity: 3 }], combo(), umaUnidade).get(0);

    expect(alocacao).toEqual({ promotionalQuantity: 3, unitDiscount: 0.33, extraCentUnits: 1 });
  });

  it("deixa a sobra do kit a preço normal", () => {
    const alocacao = allocateCombo([{ index: 0, listPrice: 7, quantity: 4 }], combo(), umaUnidade).get(0);

    expect(alocacao?.promotionalQuantity).toBe(3);
  });

  it("não dá nada abaixo da quantidade", () => {
    const alocacao = allocateCombo([{ index: 0, listPrice: 7, quantity: 2 }], combo(), umaUnidade).get(0);

    expect(alocacao).toEqual({ promotionalQuantity: 0, unitDiscount: 0, extraCentUnits: 0 });
  });

  it("forma o kit com as unidades mais caras e reparte o desconto pelo preço", () => {
    // Pote de R$ 4,00 + dois copos de R$ 2,50 num kit de R$ 8,00: R$ 1,00 de
    // desconto, R$ 0,44 no pote e R$ 0,28 em cada copo. O mesmo que o servidor
    // confere em PdvPromotionTests.Combo_ReconheceTodosOsGruposENaoSoODaCapa.
    const alocacoes = allocateCombo(
      [
        { index: 0, listPrice: 2.5, quantity: 3 },
        { index: 1, listPrice: 4, quantity: 1 },
      ],
      combo({ discountValue: 8 }),
      umaUnidade,
    );

    expect(alocacoes.get(1)).toEqual({ promotionalQuantity: 1, unitDiscount: 0.44, extraCentUnits: 0 });
    // O terceiro copo sobra: o pote, mais caro, entrou no kit no lugar dele.
    expect(alocacoes.get(0)).toEqual({ promotionalQuantity: 2, unitDiscount: 0.28, extraCentUnits: 0 });
  });

  it("não sobe o preço quando o kit sairia mais caro que as unidades avulsas", () => {
    const alocacao = allocateCombo([{ index: 0, listPrice: 5, quantity: 3 }], combo(), umaUnidade).get(0);

    expect(alocacao).toEqual({ promotionalQuantity: 3, unitDiscount: 0, extraCentUnits: 0 });
  });
});

describe("allocateCombo — a partir de N", () => {
  const dezPorCento = (preco: number) => round2(preco * 0.1);

  it("vale para TODAS as unidades quando a soma chega a N, inclusive a quarta", () => {
    const partir = combo({ discountType: PROMOTION_DISCOUNT_TYPE.Percentage, discountValue: 10 });
    const alocacoes = allocateCombo(
      [
        { index: 0, listPrice: 7, quantity: 2 },
        { index: 1, listPrice: 7, quantity: 2 },
      ],
      partir,
      dezPorCento,
    );

    expect(alocacoes.get(0)).toEqual({ promotionalQuantity: 2, unitDiscount: 0.7, extraCentUnits: 0 });
    expect(alocacoes.get(1)).toEqual({ promotionalQuantity: 2, unitDiscount: 0.7, extraCentUnits: 0 });
  });
});

describe("resolveCombo e o que falta", () => {
  it("alcança qualquer grupo do combo, e não só o da capa", () => {
    expect(resolveCombo([combo()], IMPALA, DENTRO)?.id).toBe(40);
    expect(resolveCombo([combo()], 999, DENTRO)).toBeNull();
  });

  it("lê a base local gravada antes do combo, sem a lista de grupos", () => {
    const antiga = { ...combo(), productGroupIds: undefined };

    expect(coveredGroupIds(antiga)).toEqual([RISQUE]);
  });

  it("não entra na resolução de promoção de UNIDADE", () => {
    expect(resolvePromotion([combo()], RISQUE, DENTRO)).toBeNull();
  });

  it("diz quantas unidades faltam para o próximo kit", () => {
    expect(missingForCombo(combo(), 2)).toBe(1);
    expect(missingForCombo(combo(), 3)).toBe(0);
    expect(missingForCombo(combo(), 4)).toBe(2);
    expect(missingForCombo(combo({ discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice }), 4)).toBe(0);
  });
});

describe("applyPromotionsToCart com combo", () => {
  it("cobra R$ 20,00 por três Risqué, em duas linhas de centavos diferentes", () => {
    const linhas = applyPromotionsToCart([esmalte({ quantity: 3 })], [combo()], DENTRO);

    expect(linhas.map((linha) => [linha.quantity, linha.promotionDiscount])).toEqual([
      [2, 0.33],
      [1, 0.34],
    ]);
    expect(new Set(linhas.map((linha) => linha.id)).size).toBe(2);
    expect(linhas.every((linha) => linha.promotionId === 40)).toBe(true);
    expect(totalPago(linhas)).toBe(20);
  });

  it("soma Risqué e Impala no mesmo kit, e a quarta unidade sai a preço normal", () => {
    const linhas = applyPromotionsToCart(
      [
        esmalte({ quantity: 2 }),
        esmalte({ id: "impala", productId: 2, productGroupId: IMPALA, quantity: 2 }),
      ],
      [combo()],
      DENTRO,
    );

    expect(totalPago(linhas)).toBe(27);
    expect(linhas.filter((linha) => linha.promotionId == null).map((linha) => linha.quantity)).toEqual([1]);
  });

  it("a relâmpago vence o combo, e a unidade em relâmpago não conta para o kit", () => {
    const relampago: LocalPromotion = {
      ...combo(),
      id: 5,
      productGroupIds: [RISQUE],
      comboQuantity: null,
      type: PROMOTION_TYPE.Flash,
      discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
      discountValue: 5,
      validFrom: "2026-09-19T08:00:00",
      validUntil: "2026-09-19T18:00:00",
    };

    const linhas = applyPromotionsToCart(
      [
        esmalte({ quantity: 1 }),
        esmalte({ id: "impala", productId: 2, productGroupId: IMPALA, quantity: 2 }),
      ],
      [combo(), relampago],
      DENTRO,
    );

    // Um Risqué na relâmpago (R$ 5,00) e dois Impala sem kit (R$ 14,00).
    expect(linhas.find((linha) => linha.productId === 1)?.promotionId).toBe(5);
    expect(linhas.find((linha) => linha.productId === 2)?.promotionId).toBeNull();
    expect(totalPago(linhas)).toBe(19);
  });

  it("preserva o desconto do operador por cima do combo", () => {
    const linhas = applyPromotionsToCart([esmalte({ quantity: 3, discount: 0.5 })], [combo()], DENTRO);

    expect(linhas.map((linha) => linha.discount)).toEqual([0.83, 0.84]);
  });
});

describe("describePromotions com combo", () => {
  it("mostra o combo ANTES de o kit fechar, com o que falta", () => {
    const linha = esmalte({ quantity: 2 });
    const info = describePromotions([linha], [combo()], DENTRO).get(linha.id);

    expect(info?.promotionalQuantity).toBe(0);
    expect(info?.combo).toEqual({
      quantity: 3,
      discountType: 3,
      discountValue: 20,
      lineDiscount: 0,
      missing: 1,
    });
  });

  it("descreve o desconto da LINHA inteira quando o kit fecha", () => {
    const linha = esmalte({ quantity: 3 });
    const info = describePromotions([linha], [combo()], DENTRO).get(linha.id);

    expect(info?.combo?.lineDiscount).toBe(1);
    expect(info?.combo?.missing).toBe(0);
  });
});

describe("describeComboOffer", () => {
  it("fala a língua do cartaz nos três formatos", () => {
    const frase = (discountType: number, discountValue: number) =>
      describeComboOffer({ quantity: 3, discountType, discountValue }).replace(/\s/g, " ");

    expect(frase(PROMOTION_DISCOUNT_TYPE.KitPrice, 20)).toBe("3 por R$ 20,00");
    expect(frase(PROMOTION_DISCOUNT_TYPE.FinalPrice, 6.5)).toBe("a partir de 3: R$ 6,50 cada");
    expect(frase(PROMOTION_DISCOUNT_TYPE.Percentage, 10)).toBe("a partir de 3: 10% off");
  });
});
