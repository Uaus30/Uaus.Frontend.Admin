import { describe, expect, it } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, type PromotionDto } from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import {
  BANNER_MAX_COPIES,
  bannerCandidates,
  bannerItemsOf,
  bannerPriceLabel,
  bannerPriceOf,
  bannerTitleOf,
  clampBannerCopies,
} from "../promotionBannerRules";

/** Relâmpago de exemplo; os testes ajustam só o que interessa. */
function promocao(parcial: Partial<PromotionDto> = {}): PromotionDto {
  return {
    id: 1,
    createdAt: "2026-10-16T08:00:00",
    productGroupId: 7,
    productGroupName: "COPO AMERICANO",
    type: PROMOTION_TYPE.Flash,
    discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
    discountValue: 0.99,
    validFrom: "2026-10-17T08:00:00",
    validUntil: "2026-10-17T18:00:59",
    isActive: true,
    showOnSite: false,
    investment: 0,
    referencePriceMin: 1.75,
    referencePriceMax: 1.75,
    promotionalPriceMin: 0.99,
    promotionalPriceMax: 0.99,
    ...parcial,
  };
}

/** 16/10/2026 10:00, hora local — a sexta em que o cartaz de sábado é impresso. */
const AGORA = new Date(2026, 9, 16, 10, 0, 0);

describe("bannerPriceOf", () => {
  it("promoção simples: o promocional do servidor, sem linha acima", () => {
    expect(bannerPriceOf(promocao())).toEqual({ lead: "", price: 0.99 });
  });

  it("variações com preços diferentes: 'A partir de' e o menor", () => {
    // Percentual sobre R$ 12 e R$ 18: um preço só mentiria para metade delas.
    expect(bannerPriceOf(promocao({ promotionalPriceMin: 8.4, promotionalPriceMax: 12.6 }))).toEqual({
      lead: "A partir de",
      price: 8.4,
    });
  });

  it("combo a cada N: 'N por' e o preço do KIT, não o da unidade", () => {
    const combo = promocao({
      type: PROMOTION_TYPE.Combo,
      discountType: PROMOTION_DISCOUNT_TYPE.KitPrice,
      discountValue: 20,
      comboQuantity: 3,
      promotionalPriceMin: 6.67,
      promotionalPriceMax: 6.67,
    });

    expect(bannerPriceOf(combo)).toEqual({ lead: "3 por", price: 20 });
  });

  it("combo a partir de N: o preço de cada unidade", () => {
    const combo = promocao({
      type: PROMOTION_TYPE.Combo,
      discountType: PROMOTION_DISCOUNT_TYPE.Percentage,
      discountValue: 10,
      comboQuantity: 2,
      promotionalPriceMin: 6.5,
      promotionalPriceMax: 6.5,
    });

    expect(bannerPriceOf(combo)).toEqual({ lead: "A partir de 2 un.", price: 6.5 });
  });

  it("lê o enum pelo NOME, que é como a API manda", () => {
    const combo = promocao({ type: "Combo", discountType: "KitPrice", discountValue: 20, comboQuantity: 3 });

    expect(bannerPriceOf(combo)).toEqual({ lead: "3 por", price: 20 });
  });
});

describe("bannerPriceLabel", () => {
  it("junta a frase e o preço como a modal mostra", () => {
    expect(bannerPriceLabel(promocao())).toBe(formatCurrency(0.99));
    expect(
      bannerPriceLabel(
        promocao({ type: "Combo", discountType: "KitPrice", discountValue: 20, comboQuantity: 3 }),
      ),
    ).toBe(`3 por ${formatCurrency(20)}`);
  });
});

describe("bannerCandidates", () => {
  it("só as no ar e as programadas, com as no ar na frente", () => {
    const lista = [
      promocao({ id: 1, validFrom: "2026-10-17T08:00:00", validUntil: "2026-10-17T18:00:59" }), // programada
      promocao({ id: 2, validFrom: "2026-10-10T08:00:00", validUntil: "2026-10-10T18:00:59" }), // encerrada
      promocao({ id: 3, validFrom: "2026-10-16T08:00:00", validUntil: "2026-10-16T18:00:59" }), // no ar
      promocao({ id: 4, isActive: false, validFrom: "2026-10-16T08:00:00", validUntil: null }), // inativa
    ];

    expect(bannerCandidates(lista, AGORA).map((row) => [row.id, row.situation])).toEqual([
      [3, "no-ar"],
      [1, "programada"],
    ]);
  });
});

describe("bannerTitleOf", () => {
  it("campo vazio ou só espaços volta para 'PROMOÇÃO'; o digitado vai como está", () => {
    expect(bannerTitleOf("")).toBe("PROMOÇÃO");
    expect(bannerTitleOf("   ")).toBe("PROMOÇÃO");
    expect(bannerTitleOf(" Oferta ")).toBe("Oferta");
  });
});

describe("clampBannerCopies", () => {
  it("campo vazio, zero e bobagem viram 1; fração arredonda para baixo; acima do teto, o teto", () => {
    expect(clampBannerCopies(0)).toBe(1);
    expect(clampBannerCopies(Number.NaN)).toBe(1);
    expect(clampBannerCopies(-3)).toBe(1);
    expect(clampBannerCopies(2.7)).toBe(2);
    expect(clampBannerCopies(99)).toBe(BANNER_MAX_COPIES);
  });
});

describe("bannerItemsOf", () => {
  const candidatas = bannerCandidates(
    [
      promocao({ id: 1, productGroupName: "COPO AMERICANO [ORIGINAL]", validFrom: "2026-10-16T08:00:00" }),
      promocao({ id: 2, productGroupName: "ESMALTE RISQUÉ" }),
    ],
    AGORA,
  );

  it("só as marcadas, com o nome reescrito — e o do cadastro quando o campo fica vazio", () => {
    const itens = bannerItemsOf(candidatas, {
      1: { selected: true, name: "  Copo Americano  ", copies: 2 },
      2: { selected: true, name: "   ", copies: 0 },
    });

    expect(itens).toEqual([
      { productName: "Copo Americano", lead: "", price: 0.99, copies: 2 },
      { productName: "ESMALTE RISQUÉ", lead: "", price: 0.99, copies: 1 },
    ]);
  });

  it("promoção sem edição ou desmarcada não vira banner", () => {
    expect(bannerItemsOf(candidatas, { 2: { selected: false, name: "x", copies: 1 } })).toEqual([]);
  });

  it("a edição de uma promoção que saiu da lista não vira banner", () => {
    // Encerrou entre uma impressão e outra: a lista é a verdade.
    expect(bannerItemsOf(candidatas, { 99: { selected: true, name: "", copies: 1 } })).toEqual([]);
  });
});
