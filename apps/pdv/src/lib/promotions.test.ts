import { describe, expect, it } from "vitest";
import { round2 } from "@workspace/core";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE } from "@workspace/api-client-react";
import type { LocalPromotion } from "@/offline";
import type { PdvItem } from "@/stores/pdv-cart";
import {
  allocatePromotions,
  applyPromotionsToCart,
  describePromotions,
  promotionalPrice,
  resolvePromotion,
} from "./promotions";

/**
 * A alocação da promoção no carrinho.
 *
 * O que estes testes protegem é dinheiro no balcão: o limite que divide a linha,
 * a janela que decide se a relâmpago ainda vale e a soma das variações do mesmo
 * grupo. Todos rodam com instante FIXO — a virada da janela é o caso de borda, e
 * um teste que lê o relógio de verdade passa de manhã e falha às 23h.
 */

const JANELA = { validFrom: "2026-09-19T08:00:00", validUntil: "2026-09-19T18:00:00" };
const DENTRO = "2026-09-19T14:00:00";

function promocao(overrides: Partial<LocalPromotion> = {}): LocalPromotion {
  return {
    id: 1,
    productGroupId: 10,
    type: PROMOTION_TYPE.Flash,
    discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
    discountValue: 0.99,
    validFrom: JANELA.validFrom,
    validUntil: JANELA.validUntil,
    maxQuantityPerSale: null,
    ...overrides,
  };
}

function item(overrides: Partial<PdvItem> = {}): PdvItem {
  return {
    id: "linha-1",
    productId: 100,
    productGroupId: 10,
    name: "Copo americano",
    price: 2.5,
    quantity: 1,
    discount: 0,
    availableStock: 50,
    ...overrides,
  };
}

describe("resolvePromotion", () => {
  it("deve devolver a promoção do grupo vigente no instante", () => {
    expect(resolvePromotion([promocao()], 10, DENTRO)?.id).toBe(1);
  });

  it("deve ignorar promoção de outro grupo", () => {
    expect(resolvePromotion([promocao({ productGroupId: 99 })], 10, DENTRO)).toBeNull();
  });

  it("deve ignorar promoção fora da janela", () => {
    expect(resolvePromotion([promocao()], 10, "2026-09-19T18:00:01")).toBeNull();
    expect(resolvePromotion([promocao()], 10, "2026-09-19T07:59:59")).toBeNull();
  });

  it("deve aceitar os dois extremos da janela — vigência é inclusiva nas duas pontas", () => {
    expect(resolvePromotion([promocao()], 10, JANELA.validFrom)?.id).toBe(1);
    expect(resolvePromotion([promocao()], 10, JANELA.validUntil)?.id).toBe(1);
  });

  it("deve tratar vigência sem fim como aberta", () => {
    const semFim = promocao({ validUntil: null });
    expect(resolvePromotion([semFim], 10, "2030-01-01T00:00:00")?.id).toBe(1);
  });

  it("deve preferir a relâmpago quando as duas cobrem o grupo", () => {
    const diaADia = promocao({ id: 7, type: PROMOTION_TYPE.Everyday });
    const relampago = promocao({ id: 8, type: PROMOTION_TYPE.Flash });

    // Nas duas ordens: a precedência é do tipo, não da posição na lista.
    expect(resolvePromotion([diaADia, relampago], 10, DENTRO)?.id).toBe(8);
    expect(resolvePromotion([relampago, diaADia], 10, DENTRO)?.id).toBe(8);
  });
});

describe("promotionalPrice", () => {
  it("deve aplicar o percentual sobre o preço da linha", () => {
    const meiaVez = promocao({ discountType: PROMOTION_DISCOUNT_TYPE.Percentage, discountValue: 50 });
    expect(promotionalPrice(2.5, meiaVez)).toBe(1.25);
  });

  it("deve usar o preço final tal como cadastrado, ignorando o preço da linha", () => {
    expect(promotionalPrice(2.5, promocao())).toBe(0.99);
    expect(promotionalPrice(9.9, promocao())).toBe(0.99);
  });

  it("nunca devolve preço negativo", () => {
    const absurda = promocao({ discountType: PROMOTION_DISCOUNT_TYPE.Percentage, discountValue: 150 });
    expect(promotionalPrice(2.5, absurda)).toBe(0);
  });
});

describe("allocatePromotions", () => {
  const linha = (quantity: number, listPrice = 2.5, productGroupId = 10) => ({
    productGroupId,
    listPrice,
    quantity,
  });

  it("deve promover a linha inteira quando não há limite", () => {
    const [alocacao] = allocatePromotions([linha(10)], [promocao()], DENTRO);

    expect(alocacao).toEqual({
      promotionId: 1,
      unitDiscount: 1.51,
      promotionalQuantity: 10,
      regularQuantity: 0,
    });
  });

  it("deve dividir a linha no limite por venda", () => {
    const [alocacao] = allocatePromotions([linha(10)], [promocao({ maxQuantityPerSale: 6 })], DENTRO);

    expect(alocacao.promotionalQuantity).toBe(6);
    expect(alocacao.regularQuantity).toBe(4);
  });

  it("deve somar as variações do mesmo grupo contra um limite só", () => {
    // Quatro azuis e quatro vermelhos, limite 6: o cartaz diz "6 copos por
    // cliente", e copo azul e copo vermelho são o mesmo copo para o cartaz.
    const alocacoes = allocatePromotions([linha(4), linha(4)], [promocao({ maxQuantityPerSale: 6 })], DENTRO);

    expect(alocacoes[0].promotionalQuantity).toBe(4);
    expect(alocacoes[1].promotionalQuantity).toBe(2);
    expect(alocacoes[1].regularQuantity).toBe(2);
  });

  it("deve deixar a linha inteira a preço normal quando o limite já foi consumido", () => {
    const alocacoes = allocatePromotions([linha(6), linha(3)], [promocao({ maxQuantityPerSale: 6 })], DENTRO);

    // Sem promoção nenhuma na segunda linha, a atribuição some junto: gravar
    // `promotionId` com zero unidades promocionais atribuiria à promoção uma
    // venda que ela não abateu.
    expect(alocacoes[1]).toEqual({
      promotionId: null,
      unitDiscount: 0,
      promotionalQuantity: 0,
      regularQuantity: 3,
    });
  });

  it("deve ignorar o limite quando o operador o libera nesta venda", () => {
    const alocacoes = allocatePromotions([linha(10)], [promocao({ maxQuantityPerSale: 6 })], DENTRO, [1]);

    expect(alocacoes[0].promotionalQuantity).toBe(10);
    expect(alocacoes[0].regularQuantity).toBe(0);
  });

  it("não promove nada fora da janela", () => {
    const [alocacao] = allocatePromotions([linha(10)], [promocao()], "2026-09-19T18:00:01");

    expect(alocacao.promotionId).toBeNull();
    expect(alocacao.regularQuantity).toBe(10);
  });

  it("deve calcular o desconto sobre o preço do PRODUTO, sem o acréscimo", () => {
    // O pendrive de R$ 25,00 com R$ 5,00 de gravação: a promoção de 10% incide
    // sobre os R$ 25,00 do produto, e o serviço continua sendo cobrado por
    // inteiro. É a mesma base do `DescontoEsperado` do servidor — com os R$ 30,00
    // o front daria R$ 3,00, o servidor esperaria R$ 2,50, e toda venda assim
    // sairia carimbada em `logs` como divergente.
    const dezPorCento = promocao({
      discountType: PROMOTION_DISCOUNT_TYPE.Percentage,
      discountValue: 10,
    });

    const [alocacao] = allocatePromotions([linha(1, 25)], [dezPorCento], DENTRO);
    expect(alocacao.unitDiscount).toBe(2.5);
  });
});

describe("applyPromotionsToCart", () => {
  it("não deixa o preço final da promoção engolir o acréscimo da linha", () => {
    // REGRESSÃO: a base da promoção era o preço da LINHA (produto + acréscimo).
    // O pendrive de R$ 25,00 com R$ 5,00 de gravação numa promoção de "R$ 19,90"
    // saía por R$ 19,90 — a gravação de graça — em vez de R$ 24,90.
    const precoFinal = promocao({ discountValue: 19.9 });
    const pendrive = item({ price: 25, surcharge: 5, surchargeReason: "Gravação de músicas" });

    const [linha] = applyPromotionsToCart([pendrive], [precoFinal], DENTRO);

    expect(linha.promotionDiscount).toBe(5.1);
    // 25 + 5 − 5,10 = 24,90: o produto no preço do cartaz, o serviço por inteiro.
    expect(round2(linha.price + (linha.surcharge ?? 0) - linha.discount)).toBe(24.9);
  });

  it("deve dividir a linha que passa do limite em duas, com ids diferentes", () => {
    const linhas = applyPromotionsToCart(
      [item({ quantity: 10 })],
      [promocao({ maxQuantityPerSale: 6 })],
      DENTRO,
    );

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ quantity: 6, discount: 1.51, promotionId: 1, promotionDiscount: 1.51 });
    expect(linhas[1]).toMatchObject({ quantity: 4, discount: 0, promotionId: null, promotionDiscount: 0 });
    expect(linhas[0].id).not.toBe(linhas[1].id);
  });

  it("deve somar o desconto do operador por cima do da promoção", () => {
    const [linha] = applyPromotionsToCart([item({ discount: 0.2 })], [promocao()], DENTRO);

    // O desconto total da linha é a soma dos dois; a parcela da promoção fica
    // discriminada para o servidor tirá-la do limite do vendedor.
    expect(linha.discount).toBe(1.71);
    expect(linha.promotionDiscount).toBe(1.51);
  });

  it("não aplica promoção em linha sem grupo — a venda pausada antiga volta sem ele", () => {
    const antiga = item({ productGroupId: undefined });
    const [linha] = applyPromotionsToCart([antiga], [promocao()], DENTRO);

    expect(linha.promotionId).toBeNull();
    expect(linha.discount).toBe(0);
  });

  it("deve zerar a promoção da linha quando a lista de promoções está vazia", () => {
    const comSobra = item({ promotionId: 1, promotionDiscount: 1.51, discount: 1.51 });
    const [linha] = applyPromotionsToCart([comSobra], [], DENTRO);

    expect(linha.promotionId).toBeNull();
    expect(linha.promotionDiscount).toBe(0);
  });

  it("é idempotente: reavaliar a mesma linha não soma a promoção duas vezes", () => {
    const primeira = applyPromotionsToCart([item({ quantity: 2 })], [promocao()], DENTRO);
    const segunda = applyPromotionsToCart(primeira, [promocao()], DENTRO);

    expect(segunda[0].discount).toBe(1.51);
    expect(segunda[0].promotionDiscount).toBe(1.51);
  });
});

describe("describePromotions", () => {
  it("deve descrever a divisão do limite para a linha do carrinho", () => {
    const linha = item({ quantity: 10 });
    const info = describePromotions([linha], [promocao({ maxQuantityPerSale: 6 })], DENTRO);

    expect(info.get(linha.id)).toEqual({
      promotionId: 1,
      type: PROMOTION_TYPE.Flash,
      promotionalQuantity: 6,
      regularQuantity: 4,
      unitDiscount: 1.51,
      maxQuantityPerSale: 6,
      released: false,
    });
  });

  it("deve marcar o limite liberado e devolver a linha inteira promocional", () => {
    const linha = item({ quantity: 10 });
    const info = describePromotions([linha], [promocao({ maxQuantityPerSale: 6 })], DENTRO, [1]);

    expect(info.get(linha.id)).toMatchObject({
      promotionalQuantity: 10,
      regularQuantity: 0,
      released: true,
    });
  });

  it("deve deixar de fora a linha sem promoção", () => {
    const linha = item({ productGroupId: 99 });
    expect(describePromotions([linha], [promocao()], DENTRO).has(linha.id)).toBe(false);
  });

  it("deve concordar com a alocação usada no pagamento", () => {
    // O selo da tela e o payload saem da MESMA conta: divergir aqui faria a linha
    // anunciar um desconto que o cupom impresso não mostra.
    const linhas = [item({ id: "a", quantity: 4 }), item({ id: "b", productId: 101, quantity: 4 })];
    const promocoes = [promocao({ maxQuantityPerSale: 6 })];

    const info = describePromotions(linhas, promocoes, DENTRO);
    const alocadas = applyPromotionsToCart(linhas, promocoes, DENTRO);

    expect(info.get("b")?.promotionalQuantity).toBe(2);
    expect(alocadas.filter((linha) => linha.promotionId === 1).at(-1)?.quantity).toBe(2);
  });
});
