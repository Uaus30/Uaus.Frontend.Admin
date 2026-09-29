import { round2 } from "@workspace/core";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE } from "@workspace/api-client-react";
import type { LocalPromotion } from "@/offline";
import type { PdvItem } from "@/stores/pdv-cart";
import {
  allocateCombo,
  isCombo,
  isInWindow,
  missingForCombo,
  resolveCombo,
  type ComboLineInput,
} from "./combo-promotions";

/**
 * A promoção aplicada ao carrinho: qual vale, quanto ela abate e como o limite
 * por venda divide a linha.
 *
 * É função pura, sem React e sem IndexedDB — recebe o carrinho, as promoções já
 * lidas da base local e o instante da venda. É o que permite provar a virada da
 * janela e a divisão do limite sem montar nada.
 *
 * ## O preço é DERIVADO, nunca congelado
 *
 * Mesmo desenho do cupom em `stores/pdv-cart.ts`, e pelo mesmo motivo escrito lá:
 * bipar mais uma unidade muda a alocação do limite, e um valor congelado deixaria
 * a tela mostrando um número e o payload levando outro.
 */

/** Uma promoção vigente resolvida para um grupo de produto. */
export interface AppliedPromotion {
  promotionId: number;
  /** Código do enum `PromotionType`. O relâmpago é o que a tela destaca. */
  type: number;
  /** Teto de unidades do grupo nesta venda. Nulo = sem limite. */
  maxQuantityPerSale: number | null;
}

/**
 * A promoção DE UNIDADE que vale para um grupo neste instante — relâmpago ou Dia
 * a Dia. O combo tem resolução própria (`resolveCombo`), porque o preço dele não é
 * de uma unidade.
 *
 * **Relâmpago vence Dia a Dia** — a única precedência do domínio. Duas do mesmo
 * tipo não coexistem (o banco recusa), então a escolha nunca tem três
 * candidatas.
 *
 * O instante é sempre parâmetro: é o que permite ao carrinho congelar o relógio
 * no primeiro item e não mudar o preço no meio da conferência.
 */
export function resolvePromotion(
  promotions: LocalPromotion[],
  productGroupId: number,
  instant: string,
): LocalPromotion | null {
  const vigentes = promotions.filter(
    (promotion) =>
      !isCombo(promotion) && promotion.productGroupId === productGroupId && isInWindow(promotion, instant),
  );

  if (vigentes.length === 0) return null;

  return vigentes.find((promotion) => promotion.type === PROMOTION_TYPE.Flash) ?? vigentes[0];
}

/**
 * Preço promocional de UMA unidade.
 *
 * Espelha `PromotionRules.PromotionalPrice` do backend — é a mesma conta que a
 * prévia do cadastro mostra e que o servidor usa para conferir a venda. Divergir
 * aqui é como a tela promete um preço e o cupom imprime outro.
 */
export function promotionalPrice(price: number, promotion: LocalPromotion): number {
  if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.Percentage) {
    return Math.max(0, round2(price * (1 - promotion.discountValue / 100)));
  }

  if (promotion.discountType === PROMOTION_DISCOUNT_TYPE.FinalPrice) {
    return Math.max(0, round2(promotion.discountValue));
  }

  return price;
}

/** O que a alocação precisa saber de cada linha, sem conhecer o carrinho inteiro. */
export interface PromotionAllocationInput {
  /** Grupo do produto da linha — é o grupo que a promoção promove, não o SKU. */
  productGroupId: number;
  /**
   * Preço de tabela do PRODUTO, **sem o acréscimo da linha**.
   *
   * O acréscimo é serviço vendido junto (gravar músicas no pendrive), não preço
   * de produto, e a promoção é do produto. Incluí-lo faria o preço final do
   * cartaz engolir o serviço: pendrive de R$ 25,00 com R$ 5,00 de gravação numa
   * promoção de "R$ 19,90" sairia por R$ 19,90 — a gravação de graça.
   *
   * É a mesma base que `DescontoEsperado` usa no servidor
   * (`UnitPrice + Discount − Surcharge`) e a mesma que o limite de desconto do
   * vendedor usa; divergir aqui carimbaria um alerta em `logs` a cada venda
   * assim, com a frase "desconto da promoção diferente do que a regra daria".
   */
  listPrice: number;
  quantity: number;
}

/** Quanto da linha entra na promoção, e quanto sai a preço normal. */
export interface PromotionAllocationResult {
  promotionId: number | null;
  /** Desconto em R$ por unidade das unidades promocionais. */
  unitDiscount: number;
  /** Unidades que entram no preço promocional. */
  promotionalQuantity: number;
  /** Unidades que sobram a preço normal — o excedente do limite, ou a sobra do kit. */
  regularQuantity: number;
  /** Combo: unidades que levam um centavo a mais de desconto (ver `ComboLineAllocation`). */
  extraCentUnits?: number;
  /** Combo que alcança a linha, mesmo quando ela ainda não completou o kit. */
  comboId?: number;
}

/**
 * Distribui as promoções entre as linhas do carrinho: primeiro as de unidade,
 * linha a linha, e depois os combos, sobre o carrinho inteiro.
 *
 * ## A precedência é Relâmpago, Combo, Dia a Dia
 *
 * A relâmpago é evento e vence tudo enquanto dura: a unidade em relâmpago não
 * conta para o kit. Combo e Dia a Dia no mesmo grupo o servidor recusa; se os
 * dois chegassem mesmo assim, o combo venceria — é a promoção mais recente de um
 * cartaz, não o patamar.
 *
 * ## O limite é do GRUPO e da VENDA
 *
 * Quatro azuis e quatro vermelhos com limite 6 dão 6 unidades no preço
 * promocional e 2 no preço normal: as variações somam, porque é assim que o
 * cartaz é lido ("limite de 6 copos por cliente"). O cartaz diz "por cliente" e o
 * sistema conta por venda — os dois estão certos, e a loja fala com o cliente.
 *
 * ## No limite, a ordem é a de ENTRADA no carrinho
 *
 * Previsível para quem opera e para quem confere o cupom. Dar a promoção às
 * unidades mais caras primeiro renderia mais ao cliente, mas tornaria o cupom
 * impossível de explicar no balcão — e com preço final, que é o formato do
 * cartaz, as variações custam o mesmo de qualquer jeito.
 *
 * O KIT do combo é o contrário, e de propósito: as mais caras formam o kit (ver
 * `allocateCombo`). Ali a escolha muda quanto o cliente paga, e o servidor confere
 * o total do kit reordenando as unidades — outra ordem aqui daria kits diferentes
 * dos dele, e um alerta em `logs` a cada venda.
 *
 * @param lines Linhas do carrinho, na ordem em que foram bipadas.
 * @param promotions Promoções da base local.
 * @param instant Instante da venda, congelado no primeiro item.
 */
export function allocatePromotions(
  lines: PromotionAllocationInput[],
  promotions: LocalPromotion[],
  instant: string,
  released: readonly number[] = [],
): PromotionAllocationResult[] {
  const consumidoPorPromocao = new Map<number, number>();
  const combos = new Map<number, { combo: LocalPromotion; linhas: ComboLineInput[] }>();

  const resultado = lines.map((line, index): PromotionAllocationResult => {
    const unitaria = resolvePromotion(promotions, line.productGroupId, instant);
    const combo =
      unitaria?.type === PROMOTION_TYPE.Flash ? null : resolveCombo(promotions, line.productGroupId, instant);

    // O combo não se decide linha a linha: guarda e resolve depois, com o
    // carrinho inteiro na mão.
    if (combo) {
      const grupo = combos.get(combo.id) ?? { combo, linhas: [] };
      grupo.linhas.push({ index, listPrice: line.listPrice, quantity: line.quantity });
      combos.set(combo.id, grupo);
    }

    const promocao = combo ? null : unitaria;

    if (!promocao) {
      return {
        promotionId: null,
        unitDiscount: 0,
        promotionalQuantity: 0,
        regularQuantity: line.quantity,
      };
    }

    const unitDiscount = round2(Math.max(0, line.listPrice - promotionalPrice(line.listPrice, promocao)));

    // Sem limite — ou com o limite liberado pelo operador nesta venda —, a linha
    // inteira é promocional. A liberação é do domínio: o limite é comunicação
    // comercial, não trava, e o caso já aconteceu (um casal somou as compras e
    // passou junto no caixa). Sem ela, o balcão teria que desfazer e refazer a
    // venda em duas na fila do sábado para chegar ao mesmo total. O servidor
    // carimba a venda acima do limite em `logs`, e é assim que o limite continua
    // significando alguma coisa quando a promoção for medida depois.
    if (promocao.maxQuantityPerSale == null || released.includes(promocao.id)) {
      return {
        promotionId: promocao.id,
        unitDiscount,
        promotionalQuantity: line.quantity,
        regularQuantity: 0,
      };
    }

    const jaConsumido = consumidoPorPromocao.get(promocao.id) ?? 0;
    const disponivel = Math.max(0, promocao.maxQuantityPerSale - jaConsumido);
    const promotionalQuantity = Math.min(line.quantity, disponivel);

    consumidoPorPromocao.set(promocao.id, jaConsumido + promotionalQuantity);

    return {
      promotionId: promotionalQuantity > 0 ? promocao.id : null,
      unitDiscount: promotionalQuantity > 0 ? unitDiscount : 0,
      promotionalQuantity,
      regularQuantity: line.quantity - promotionalQuantity,
    };
  });

  for (const { combo, linhas } of combos.values()) {
    const alocacoes = allocateCombo(linhas, combo, (listPrice) =>
      round2(Math.max(0, listPrice - promotionalPrice(listPrice, combo))),
    );

    for (const linha of linhas) {
      const alocacao = alocacoes.get(linha.index);
      if (!alocacao) continue;

      resultado[linha.index] = {
        promotionId: alocacao.promotionalQuantity > 0 ? combo.id : null,
        unitDiscount: round2(alocacao.unitDiscount),
        promotionalQuantity: alocacao.promotionalQuantity,
        regularQuantity: linha.quantity - alocacao.promotionalQuantity,
        extraCentUnits: alocacao.extraCentUnits,
        comboId: combo.id,
      };
    }
  }

  return resultado;
}

/**
 * Aplica a alocação ao carrinho, dividindo em duas linhas o que passar do limite.
 *
 * ## Por que duas linhas, e não uma com desconto médio
 *
 * `discount` é **por unidade** em `SaleItem`, em `SaleItemForTotals` e no
 * `packages/receipt`. Um desconto médio produziria centavos que o cupom não
 * consegue explicar — e o cupom é o que o cliente lê no balcão para entender por
 * que seis saíram a R$ 0,99 e quatro a R$ 2,50.
 *
 * O desconto manual que o operador tenha dado na linha é preservado: ele soma
 * por cima do da promoção, e o servidor separa os dois pela parcela declarada.
 */
export function applyPromotionsToCart(
  items: PdvItem[],
  promotions: LocalPromotion[],
  instant: string,
  released: readonly number[] = [],
): PdvItem[] {
  if (promotions.length === 0) return items.map(semPromocao);

  const alocacoes = allocatePromotions(toAllocationInput(items), promotions, instant, released);
  const resultado: PdvItem[] = [];

  items.forEach((item, indice) => {
    const alocacao = alocacoes[indice];
    // O desconto que o OPERADOR deu, separado do da promoção: sem isto, reavaliar
    // o carrinho somaria a promoção de novo por cima dela mesma a cada bipada.
    const manual = Math.max(0, round2(item.discount - (item.promotionDiscount ?? 0)));

    if (alocacao.promotionalQuantity === 0) {
      resultado.push({ ...semPromocao(item), discount: manual });
      return;
    }

    // O centavo do kit: "3 por R$ 20" em esmaltes de R$ 7,00 sai em duas linhas,
    // duas unidades a R$ 6,67 e uma a R$ 6,66. O servidor aceita o mesmo produto
    // com o mesmo combo em duas linhas porque o desconto por unidade difere.
    const comCentavo = alocacao.extraCentUnits ?? 0;
    const semCentavo = alocacao.promotionalQuantity - comCentavo;

    if (semCentavo > 0) {
      resultado.push({
        ...item,
        quantity: semCentavo,
        discount: round2(manual + alocacao.unitDiscount),
        promotionId: alocacao.promotionId,
        promotionDiscount: alocacao.unitDiscount,
      });
    }

    if (comCentavo > 0) {
      const promotionDiscount = round2(alocacao.unitDiscount + 0.01);
      resultado.push({
        ...item,
        id: semCentavo > 0 ? `${item.id}-centavo` : item.id,
        quantity: comCentavo,
        discount: round2(manual + promotionDiscount),
        promotionId: alocacao.promotionId,
        promotionDiscount,
      });
    }

    if (alocacao.regularQuantity > 0) {
      resultado.push({
        ...semPromocao(item),
        // Id próprio: a linha do excedente é uma linha de verdade no carrinho, e
        // duas linhas com o mesmo id quebrariam a edição de quantidade.
        id: `${item.id}-sem-promocao`,
        quantity: alocacao.regularQuantity,
        discount: manual,
      });
    }
  });

  return resultado;
}

/** A linha sem promoção nenhuma — usada quando a alocação não alcança a linha. */
function semPromocao(item: PdvItem): PdvItem {
  return { ...item, promotionId: null, promotionDiscount: 0 };
}

/** O carrinho no formato que a alocação entende. */
function toAllocationInput(items: PdvItem[]): PromotionAllocationInput[] {
  return items.map((item) => ({
    // Zero quando a linha não sabe o grupo (venda pausada de antes desta
    // feature): nenhuma promoção casa com o grupo zero, e a linha sai a preço
    // normal em vez de receber a promoção de outro produto.
    productGroupId: item.productGroupId ?? 0,
    // `item.price`, e NÃO `itemListPrice(item)`: o acréscimo fica de fora da base
    // da promoção. Ver o porquê em `PromotionAllocationInput.listPrice`.
    listPrice: round2(item.price),
    quantity: item.quantity,
  }));
}

/** O que a linha do carrinho mostra sobre a promoção que a alcançou. */
export interface PromotionLineInfo {
  promotionId: number;
  /** Código do enum `PromotionType` — é ele que separa "Relâmpago" de "Dia a Dia". */
  type: number;
  /** Unidades no preço promocional. */
  promotionalQuantity: number;
  /** Unidades a preço normal: o excedente do limite. Zero é o caso comum. */
  regularQuantity: number;
  /** Desconto por unidade das unidades promocionais, em R$. */
  unitDiscount: number;
  /** Teto de unidades do grupo nesta venda. Nulo = sem limite. */
  maxQuantityPerSale: number | null;
  /** O operador liberou o limite desta promoção nesta venda. */
  released: boolean;
  /** Só no combo: o que o selo precisa para falar a língua do cartaz. */
  combo?: PromotionComboInfo;
}

/** O combo que alcança a linha, como o selo o descreve. */
export interface PromotionComboInfo {
  /** Unidades do kit, ou o "a partir de". */
  quantity: number;
  /** Código de `PromotionDiscountType`: o preço do kit é "a cada N", os outros "a partir de N". */
  discountType: number;
  /** Preço do kit, percentual ou preço por unidade, conforme o tipo. */
  discountValue: number;
  /** Desconto da LINHA inteira, em R$ — no kit, os centavos não são iguais por unidade. */
  lineDiscount: number;
  /** Unidades que faltam no carrinho para o próximo kit, ou para o combo valer. */
  missing: number;
}

/**
 * O que cada linha do carrinho ganhou de promoção, para a TELA — não para o
 * pagamento.
 *
 * O carrinho mostra uma linha por produto (a divisão do limite é informação da
 * venda, não uma segunda linha editável), então a tela precisa de um resumo por
 * `id` de linha em vez das linhas já divididas que o pagamento usa. É a MESMA
 * alocação: chamar `allocatePromotions` duas vezes com a mesma entrada dá o mesmo
 * resultado, e é isso que mantém o selo da tela e o cupom impresso contando a
 * mesma história.
 *
 * @returns Um mapa por `PdvItem.id`; linha sem promoção simplesmente não entra.
 */
export function describePromotions(
  items: PdvItem[],
  promotions: LocalPromotion[],
  instant: string,
  released: readonly number[] = [],
): Map<string, PromotionLineInfo> {
  const info = new Map<string, PromotionLineInfo>();
  if (promotions.length === 0) return info;

  const entradas = toAllocationInput(items);
  const alocacoes = allocatePromotions(entradas, promotions, instant, released);

  items.forEach((item, indice) => {
    const alocacao = alocacoes[indice];
    const promotionId = alocacao.promotionId ?? alocacao.comboId;
    if (promotionId == null) return;

    const promocao = promotions.find((candidate) => candidate.id === promotionId);
    if (!promocao) return;

    if (alocacao.comboId != null) {
      // O combo aparece MESMO antes de fechar o kit: é o que o operador diz ao
      // cliente que pegou dois esmaltes — "leve mais um e sai por R$ 20".
      const unidadesNoCombo = alocacoes.reduce(
        (soma, outra, posicao) => (outra.comboId === promocao.id ? soma + entradas[posicao].quantity : soma),
        0,
      );

      info.set(item.id, {
        promotionId: promocao.id,
        type: promocao.type,
        promotionalQuantity: alocacao.promotionalQuantity,
        regularQuantity: alocacao.regularQuantity,
        unitDiscount: alocacao.unitDiscount,
        maxQuantityPerSale: null,
        released: false,
        combo: {
          quantity: promocao.comboQuantity ?? 0,
          discountType: promocao.discountType,
          discountValue: promocao.discountValue,
          lineDiscount: round2(
            alocacao.unitDiscount * alocacao.promotionalQuantity + 0.01 * (alocacao.extraCentUnits ?? 0),
          ),
          missing: missingForCombo(promocao, unidadesNoCombo),
        },
      });
      return;
    }

    info.set(item.id, {
      promotionId: promocao.id,
      type: promocao.type,
      promotionalQuantity: alocacao.promotionalQuantity,
      regularQuantity: alocacao.regularQuantity,
      unitDiscount: alocacao.unitDiscount,
      maxQuantityPerSale: promocao.maxQuantityPerSale,
      released: promocao.maxQuantityPerSale != null && released.includes(promocao.id),
    });
  });

  return info;
}
