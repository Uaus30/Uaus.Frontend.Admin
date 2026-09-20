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
  repeatFormFromPromotion,
  toEndInstant,
  toStartInstant,
} from "../promotionRules";
import { promotionRepeatPathname, promotionRepeatSourceFromSearch } from "../../promotion-route";
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
    investment: 0,
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

  it("ignora o horário no Dia a Dia, mesmo vindo preenchido do tipo Relâmpago", () => {
    // Cenário real: a pessoa começa cadastrando uma relâmpago das 14h às 18h e
    // muda para Dia a Dia. O campo de horário sai da tela — compor com ele faria
    // um PATAMAR de preço começar às 14h, sem nada na tela para desfazer.
    const trocouDeTipo = formulario({
      discountValue: "10",
      startTime: "14:00",
      endTime: "18:00",
      noEndDate: false,
      endDate: diaDaPromocao,
    });

    const payload = buildPromotionPayload(trocouDeTipo);

    expect(payload.validFrom).toBe("2026-09-19T00:00:00");
    expect(payload.validUntil).toBe("2026-09-19T23:59:59");
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

describe("repetir promoção", () => {
  // 19/09/2026 é um sábado; 21/09/2026 é uma segunda. A HORA importa: a promoção
  // do fixture vai das 14h às 18h, e repetir depois disso não pode cair em hoje.
  const segunda = new Date(2026, 8, 21);

  it("propõe a PRÓXIMA ocorrência do mesmo dia da semana", () => {
    // A relâmpago da loja é semanal. Repetir a de sábado passado numa segunda
    // deve propor o sábado seguinte — copiar a data original seria cadastro
    // condenado, e deixá-la em branco devolveria a redigitação que o atalho
    // existe para evitar.
    const form = repeatFormFromPromotion(promocao(), segunda);

    expect(form.startDate?.getDay()).toBe(6);
    expect(form.startDate?.getDate()).toBe(26);
    expect(form.endDate?.getDate()).toBe(26);
  });

  it("mantém HOJE quando hoje já é o dia da semana da promoção", () => {
    // A loja cadastra a relâmpago no próprio sábado de manhã; empurrar para o
    // sábado seguinte obrigaria a corrigir a data toda vez.
    const form = repeatFormFromPromotion(promocao(), new Date(2026, 8, 19, 9, 30));

    expect(form.startDate?.getDate()).toBe(19);
  });

  it("pula para a semana seguinte quando a janela de hoje já acabou", () => {
    // REGRESSÃO: `nextWeekdayOccurrence` comparava só o DIA DA SEMANA. Às 19h40
    // de sábado — que é quando o dono confere o dia, porque é quando a aba
    // Performance deixa de avisar "os números são parciais" — a cópia de
    // 14h–18h caía em HOJE. A validação compara datas e o servidor também, então
    // ninguém barrava: a promoção nascia "Encerrada" e o dono achava que tinha
    // programado o sábado seguinte.
    const form = repeatFormFromPromotion(promocao(), new Date(2026, 8, 19, 19, 40));

    expect(form.startDate?.getDate()).toBe(26);
    expect(form.endDate?.getDate()).toBe(26);
  });

  it("ainda propõe hoje enquanto a janela de hoje não terminou", () => {
    // 17h59, com a relâmpago das 14h às 18h: dá para repetir hoje mesmo.
    const form = repeatFormFromPromotion(promocao(), new Date(2026, 8, 19, 17, 59));

    expect(form.startDate?.getDate()).toBe(19);
  });

  it("copia produto, desconto e horário, mas não o banner nem a data original", () => {
    const form = repeatFormFromPromotion(
      promocao({ maxQuantityPerSale: 6, targetQuantity: 60, showOnSite: true }),
      segunda,
    );

    expect(form.productGroupId).toBe(7);
    expect(form.discountValue).toBe("0,99");
    expect(form.startTime).toBe("14:00");
    expect(form.maxQuantityPerSale).toBe("6");
    expect(form.targetQuantity).toBe("60");
    // Duas relâmpagos no banner não podem se sobrepor: herdar a marcação faria o
    // salvamento voltar um 400 sobre uma caixa que a pessoa não marcou.
    expect(form.showOnSite).toBe(false);
    expect(form.isActive).toBe(true);
  });

  it("o Dia a Dia repetido começa hoje e sem prazo", () => {
    const form = repeatFormFromPromotion(
      promocao({ type: PROMOTION_TYPE.Everyday, validUntil: null }),
      segunda,
    );

    expect(form.startDate?.getDate()).toBe(21);
    expect(form.noEndDate).toBe(true);
    expect(form.endDate).toBeUndefined();
  });

  it("a promoção de origem viaja na URL, e o id inválido é ignorado", () => {
    // A barra de endereços é editável por qualquer um: um id quebrado não pode
    // deixar a tela esperando por uma promoção que não existe.
    expect(promotionRepeatPathname(5)).toBe("/marketing/promocoes/nova?repetir=5");
    expect(promotionRepeatSourceFromSearch("?repetir=5")).toBe(5);
    expect(promotionRepeatSourceFromSearch("?repetir=abc")).toBeUndefined();
    expect(promotionRepeatSourceFromSearch("?repetir=0")).toBeUndefined();
    expect(promotionRepeatSourceFromSearch("")).toBeUndefined();
  });
});
