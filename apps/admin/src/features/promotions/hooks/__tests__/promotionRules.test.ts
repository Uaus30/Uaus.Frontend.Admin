import { describe, expect, it } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, type PromotionDto } from "@workspace/api-client-react";
import {
  buildPromotionPayload,
  describeFormProblem,
  emptyPromotionForm,
  formFromPromotion,
  instantToDate,
  instantToTime,
  promotionSituation,
  toEndInstant,
  toStartInstant,
} from "../promotionRules";
import type { PromotionForm } from "../../types";

/**
 * As regras puras das promoções.
 *
 * O que está sendo protegido é a composição dos instantes — a armadilha 5 e 6 do
 * CLAUDE.md, que já fez vigência morrer três horas antes no Brasil — e a
 * assimetria do desconto zero entre as duas espécies.
 */

const diaDaPromocao = new Date(2026, 8, 19); // 19/09/2026, sexta

function formulario(parcial: Partial<PromotionForm> = {}): PromotionForm {
  return { ...emptyPromotionForm(diaDaPromocao), productGroupId: 7, productGroupName: "COPO", ...parcial };
}

function promocao(parcial: Partial<PromotionDto> = {}): PromotionDto {
  return {
    id: 1,
    createdAt: "2026-09-19T08:00:00",
    productGroupId: 7,
    productGroupName: "COPO AMERICANO",
    type: PROMOTION_TYPE.Flash,
    discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
    discountValue: 0.99,
    validFrom: "2026-09-19T14:00:00",
    validUntil: "2026-09-19T18:00:59",
    isActive: true,
    showOnSite: false,
    referencePriceMin: 1.75,
    referencePriceMax: 1.75,
    promotionalPriceMin: 0.99,
    promotionalPriceMax: 0.99,
    ...parcial,
  };
}

describe("composição dos instantes", () => {
  it("usa os componentes locais da data, nunca o UTC", () => {
    // `toISOString()` daria "2026-09-19T03:00:00.000Z" às 00h no Brasil, e a
    // promoção começaria na véspera do dia escolhido.
    expect(toStartInstant(diaDaPromocao, "14:00")).toBe("2026-09-19T14:00:00");
  });

  it("fecha o fim no último segundo do minuto escolhido", () => {
    // Um fim às 18:00 significa "até o fim de 18:00" — sem os 59 segundos, a
    // promoção morreria com quase um minuto de antecedência.
    expect(toEndInstant(diaDaPromocao, "18:00")).toBe("2026-09-19T18:00:59");
  });

  it("lê o dia e a hora de volta sem passar pelo fuso", () => {
    const data = instantToDate("2026-09-19T14:00:00");

    expect(data?.getFullYear()).toBe(2026);
    expect(data?.getMonth()).toBe(8);
    expect(data?.getDate()).toBe(19);
    expect(instantToTime("2026-09-19T14:00:00", "00:00")).toBe("14:00");
  });
});

describe("situação", () => {
  it("é inativa quando o indicador está desligado, mesmo dentro da vigência", () => {
    const agora = new Date(2026, 8, 19, 15, 0, 0);

    expect(promotionSituation(promocao({ isActive: false }), agora)).toBe("inativa");
  });

  it("separa programada, no ar e encerrada pelo instante, não pelo dia", () => {
    const promo = promocao();

    expect(promotionSituation(promo, new Date(2026, 8, 19, 10, 0, 0))).toBe("programada");
    expect(promotionSituation(promo, new Date(2026, 8, 19, 15, 0, 0))).toBe("no-ar");
    // 20h do MESMO dia: comparar por dia diria "no ar" numa promoção que acabou.
    expect(promotionSituation(promo, new Date(2026, 8, 19, 20, 0, 0))).toBe("encerrada");
  });

  it("sem prazo nunca encerra", () => {
    const patamar = promocao({ type: PROMOTION_TYPE.Everyday, validUntil: null });

    expect(promotionSituation(patamar, new Date(2030, 0, 1))).toBe("no-ar");
  });
});

describe("validação do formulário", () => {
  it("cobra o produto e o valor", () => {
    expect(describeFormProblem(formulario({ productGroupId: null }))).toMatch(/produto/i);
    expect(describeFormProblem(formulario({ discountValue: "" }))).toMatch(/valor do desconto/i);
  });

  it("aceita desconto zero no Dia a Dia e recusa na relâmpago", () => {
    // A isca da porta: o pote de R$ 2,00 já é barato de propósito.
    expect(describeFormProblem(formulario({ discountValue: "0" }))).toBeNull();

    const relampago = formulario({ type: PROMOTION_TYPE.Flash, discountValue: "0" });
    expect(describeFormProblem(relampago)).toMatch(/maior que zero/i);
  });

  it("recusa preço final ZERO, ainda que seja Dia a Dia", () => {
    // A decisão de aceitar zero fala do DESCONTO (percentual), não do PREÇO:
    // preço final zero gravaria o produto a R$ 0,00 no balcão.
    const iscaComPrecoFinal = formulario({
      discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
      discountValue: "0",
    });

    expect(describeFormProblem(iscaComPrecoFinal)).toMatch(/maior que zero/i);
  });

  it("cobra limite e meta ilegíveis, em vez de descartar em silêncio", () => {
    // Descartar faria o cadastro gravar "sem limite" numa promoção cujo cartaz
    // promete um limite — e ninguém saberia até o sábado.
    expect(
      describeFormProblem(formulario({ discountValue: "10", maxQuantityPerSale: "meia dúzia" })),
    ).toMatch(/limite por venda/i);

    expect(describeFormProblem(formulario({ discountValue: "10", targetQuantity: "bastante" }))).toMatch(
      /meta/i,
    );

    // Fração não é unidade: "6,5" não é um limite possível.
    expect(describeFormProblem(formulario({ discountValue: "10", maxQuantityPerSale: "6,5" }))).toMatch(
      /limite por venda/i,
    );
  });

  it("perdoa o sufixo que o operador digita junto do número", () => {
    // `parseFloat("6 un")` é 6: o parser do core para no primeiro caractere
    // inválido, e é o comportamento que todo campo de valor do admin já tem.
    const payload = buildPromotionPayload(formulario({ discountValue: "10", maxQuantityPerSale: "6 un" }));

    expect(payload.maxQuantityPerSale).toBe(6);
  });

  it("recusa percentual acima de 90", () => {
    expect(describeFormProblem(formulario({ discountValue: "95" }))).toMatch(/90%/);
  });

  it("recusa relâmpago terminando antes de começar", () => {
    const relampago = formulario({
      type: PROMOTION_TYPE.Flash,
      discountValue: "30",
      startTime: "18:00",
      endTime: "14:00",
    });

    expect(describeFormProblem(relampago)).toMatch(/depois do início/i);
  });

  it("recusa relâmpago em dia passado", () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    const relampago = formulario({ type: PROMOTION_TYPE.Flash, discountValue: "30", startDate: ontem });

    expect(describeFormProblem(relampago)).toMatch(/hoje ou de um dia futuro/i);
  });
});

describe("payload", () => {
  it("compõe o fim da relâmpago com o dia do INÍCIO", () => {
    // Deixar o fim sair do `endDate` abriria a porta para uma relâmpago das 23h
    // de sábado às 4h de domingo: passa pelo teto de 24 horas e cai num dia em
    // que a loja nem abre.
    const outroDia = new Date(2026, 8, 25);
    const relampago = formulario({
      type: PROMOTION_TYPE.Flash,
      discountValue: "0,99",
      discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
      startTime: "14:00",
      endTime: "18:00",
      endDate: outroDia,
    });

    const payload = buildPromotionPayload(relampago);

    expect(payload.validFrom).toBe("2026-09-19T14:00:00");
    expect(payload.validUntil).toBe("2026-09-19T18:00:59");
  });

  it("manda null, e não zero, quando limite e meta estão vazios", () => {
    const payload = buildPromotionPayload(formulario({ discountValue: "10" }));

    expect(payload.maxQuantityPerSale).toBeNull();
    expect(payload.targetQuantity).toBeNull();
  });

  it("entende o ponto como separador de MILHAR na meta", () => {
    // `Number("1.000")` é 1 em JavaScript: sem o parser do core, o investimento
    // projetado sairia mil vezes menor e a decisão de preço iria junto.
    const payload = buildPromotionPayload(formulario({ discountValue: "10", targetQuantity: "1.000" }));

    expect(payload.targetQuantity).toBe(1000);
  });

  it("zera o banner fora da relâmpago", () => {
    // Trocar o tipo com a caixa marcada devolveria um 400 que ninguém relaciona
    // com a caixa.
    const payload = buildPromotionPayload(formulario({ discountValue: "10", showOnSite: true }));

    expect(payload.showOnSite).toBe(false);
  });

  it("não manda fim quando o Dia a Dia é sem prazo", () => {
    const payload = buildPromotionPayload(formulario({ discountValue: "10", noEndDate: true }));

    expect(payload.validUntil).toBeNull();
  });
});

describe("formulário a partir de uma promoção", () => {
  it("reconhece sem prazo e traz o valor com vírgula", () => {
    const form = formFromPromotion(
      promocao({ type: PROMOTION_TYPE.Everyday, validUntil: null, discountValue: 12.5 }),
    );

    expect(form.noEndDate).toBe(true);
    expect(form.discountValue).toBe("12,5");
    expect(form.startTime).toBe("14:00");
  });
});
