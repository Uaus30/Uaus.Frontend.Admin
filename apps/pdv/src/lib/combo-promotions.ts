import { formatCurrency } from "@workspace/core";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE } from "@workspace/api-client-react";
import type { LocalPromotion } from "@/offline";

/**
 * O combo no carrinho: "3 esmaltes Risqué ou Impala por R$ 20" e "a partir de 3,
 * R$ 6,50 cada".
 *
 * Mora fora de `promotions.ts` porque a conta é outra: a relâmpago e o Dia a Dia
 * derrubam o preço de UMA unidade, e o combo só existe olhando o carrinho inteiro —
 * a quarta unidade de um "3 por 20" sai a preço normal, e o desconto do kit se
 * reparte entre produtos diferentes.
 *
 * Espelha `PromotionRules.ComboDiscount` do backend, que confere a venda com a
 * mesma regra. Divergir aqui carimba um alerta em `logs` a cada venda com combo.
 */

/** A vigência é inclusiva nas duas pontas; fim nulo é sem prazo. */
export function isInWindow(promotion: LocalPromotion, instant: string): boolean {
  return promotion.validFrom <= instant && (promotion.validUntil == null || promotion.validUntil >= instant);
}

/**
 * Os grupos que a promoção alcança. Cai no `productGroupId` quando a lista falta —
 * é o registro gravado na base local antes do combo existir.
 */
export function coveredGroupIds(promotion: LocalPromotion): number[] {
  return promotion.productGroupIds && promotion.productGroupIds.length > 0
    ? promotion.productGroupIds
    : [promotion.productGroupId];
}

/** Combo de verdade: o tipo, e uma quantidade que forme o kit. */
export function isCombo(promotion: LocalPromotion): boolean {
  return promotion.type === PROMOTION_TYPE.Combo && (promotion.comboQuantity ?? 0) >= 2;
}

/**
 * O combo vigente que alcança o grupo. O servidor recusa dois combos com um grupo
 * em comum no mesmo período, então nunca há duas candidatas.
 */
export function resolveCombo(
  promotions: LocalPromotion[],
  productGroupId: number,
  instant: string,
): LocalPromotion | null {
  return (
    promotions.find(
      (promotion) =>
        isCombo(promotion) &&
        isInWindow(promotion, instant) &&
        coveredGroupIds(promotion).includes(productGroupId),
    ) ?? null
  );
}

/** Uma linha do carrinho que o combo alcança. */
export interface ComboLineInput {
  /** Posição da linha no carrinho — a chave do resultado. */
  index: number;
  /** Preço de tabela do produto, sem o acréscimo (ver `PromotionAllocationInput`). */
  listPrice: number;
  quantity: number;
}

/** O que o combo decidiu para UMA linha. */
export interface ComboLineAllocation {
  /** Unidades que entram no combo. O resto da linha sai a preço normal. */
  promotionalQuantity: number;
  /** Desconto por unidade, em R$, das unidades do combo. */
  unitDiscount: number;
  /**
   * Quantas das unidades do combo levam UM CENTAVO a mais de desconto.
   *
   * Existe porque o kit fecha no centavo: R$ 1,00 de desconto em três esmaltes de
   * R$ 7,00 não se divide igual. Duas unidades saem a R$ 6,67 e uma a R$ 6,66, e a
   * linha vira duas no pagamento — `discount` é POR UNIDADE em `sale_items`, e uma
   * linha só daria R$ 20,01 no "3 por R$ 20".
   */
  extraCentUnits: number;
}

/**
 * Distribui o combo pelas linhas que ele alcança.
 *
 * **Preço do kit ("a cada N").** As unidades são ordenadas da mais cara para a
 * mais barata (empate: a ordem em que entraram no carrinho) e agrupadas de N em N;
 * a sobra não entra. Mais caras primeiro porque é o que o cliente faria passando as
 * compras em duas vendas — e com preços iguais, que é o caso do cartaz, a ordem
 * não muda nada. O desconto de cada kit (`soma − preço do kit`, nunca negativo) se
 * reparte pelas unidades na proporção do preço, em centavos, com o resto para as
 * maiores frações. Por fim cada linha soma o que as unidades dela ganharam e
 * reparte entre elas: no máximo dois valores por linha, a um centavo de distância.
 *
 * **Percentual ou preço final ("a partir de N").** Abaixo de N, nada; a partir de
 * N, todas as unidades ganham o desconto de uma unidade.
 *
 * @param unitDiscount Desconto de UMA unidade no "a partir de N" — é o
 *   `promotionalPrice` de `promotions.ts`, recebido por parâmetro para os dois
 *   arquivos não se importarem mutuamente.
 * @returns Uma entrada por `index` recebido.
 */
export function allocateCombo(
  lines: ComboLineInput[],
  combo: LocalPromotion,
  unitDiscount: (listPrice: number) => number,
): Map<number, ComboLineAllocation> {
  const resultado = new Map<number, ComboLineAllocation>(
    lines.map((line) => [line.index, { promotionalQuantity: 0, unitDiscount: 0, extraCentUnits: 0 }]),
  );

  const quantidade = combo.comboQuantity ?? 0;
  const total = lines.reduce((soma, line) => soma + line.quantity, 0);
  if (quantidade < 2 || total < quantidade) return resultado;

  if (combo.discountType !== PROMOTION_DISCOUNT_TYPE.KitPrice) {
    for (const line of lines) {
      resultado.set(line.index, {
        promotionalQuantity: line.quantity,
        unitDiscount: unitDiscount(line.listPrice),
        extraCentUnits: 0,
      });
    }
    return resultado;
  }

  const unidades = lines
    .flatMap((line, ordem) =>
      Array.from({ length: line.quantity }, () => ({
        index: line.index,
        ordem,
        centavos: toCents(line.listPrice),
      })),
    )
    .sort((a, b) => b.centavos - a.centavos || a.ordem - b.ordem);

  const kits = Math.floor(unidades.length / quantidade);
  const precoDoKit = toCents(combo.discountValue);
  const porLinha = new Map<number, { unidades: number; centavos: number }>();

  for (let kit = 0; kit < kits; kit++) {
    const doKit = unidades.slice(kit * quantidade, (kit + 1) * quantidade);
    const soma = doKit.reduce((acumulado, unidade) => acumulado + unidade.centavos, 0);
    const partes = distributeCents(
      Math.max(0, soma - precoDoKit),
      doKit.map((unidade) => unidade.centavos),
    );

    doKit.forEach((unidade, posicao) => {
      const atual = porLinha.get(unidade.index) ?? { unidades: 0, centavos: 0 };
      porLinha.set(unidade.index, {
        unidades: atual.unidades + 1,
        centavos: atual.centavos + partes[posicao],
      });
    });
  }

  for (const [index, { unidades: noKit, centavos }] of porLinha) {
    resultado.set(index, {
      promotionalQuantity: noKit,
      unitDiscount: Math.floor(centavos / noKit) / 100,
      extraCentUnits: centavos % noKit,
    });
  }

  return resultado;
}

/**
 * Quantas unidades faltam para o próximo kit — ou para o "a partir de N" valer.
 * Zero quando o combo já alcança tudo o que está no carrinho.
 *
 * É o que o operador diz ao cliente que pegou dois esmaltes: "leve mais um e sai
 * por R$ 20".
 */
export function missingForCombo(combo: LocalPromotion, totalUnits: number): number {
  const quantidade = combo.comboQuantity ?? 0;
  if (quantidade < 2 || totalUnits === 0) return 0;

  if (combo.discountType !== PROMOTION_DISCOUNT_TYPE.KitPrice) {
    return Math.max(0, quantidade - totalUnits);
  }

  const sobra = totalUnits % quantidade;
  return sobra === 0 ? 0 : quantidade - sobra;
}

/**
 * Reparte `total` centavos na proporção dos pesos, sem perder nem criar centavo:
 * a parte inteira de cada um e, o que sobrar, um centavo para as maiores frações
 * (empate: a posição). Conta em inteiros — fração de ponto flutuante decidindo quem
 * leva o centavo daria resultados diferentes em máquinas diferentes.
 */
function distributeCents(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((acumulado, peso) => acumulado + peso, 0);
  if (total <= 0 || soma <= 0) return pesos.map(() => 0);

  const partes = pesos.map((peso) => Math.floor((total * peso) / soma));
  let resto = total - partes.reduce((acumulado, parte) => acumulado + parte, 0);

  const ordem = pesos
    .map((peso, posicao) => ({ posicao, fracao: (total * peso) % soma }))
    .sort((a, b) => b.fracao - a.fracao || a.posicao - b.posicao);

  for (let i = 0; resto > 0; i++, resto--) {
    partes[ordem[i % ordem.length].posicao] += 1;
  }

  return partes;
}

/** Reais em centavos inteiros. `Math.round` porque 7 × 0,1 não é 0,7 em ponto flutuante. */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * O cartaz do combo em uma frase, como a loja o escreve: "3 por R$ 20,00", "a
 * partir de 3: R$ 6,50 cada", "a partir de 3: 10% off".
 */
export function describeComboOffer(combo: {
  quantity: number;
  discountType: number;
  discountValue: number;
}): string {
  if (combo.discountType === PROMOTION_DISCOUNT_TYPE.KitPrice) {
    return `${combo.quantity} por ${formatCurrency(combo.discountValue)}`;
  }

  if (combo.discountType === PROMOTION_DISCOUNT_TYPE.Percentage) {
    return `a partir de ${combo.quantity}: ${combo.discountValue.toLocaleString("pt-BR")}% off`;
  }

  return `a partir de ${combo.quantity}: ${formatCurrency(combo.discountValue)} cada`;
}
