import { round2 } from "./money";

/**
 * Descontos e totais da venda.
 *
 * Esta é a ÚNICA implementação da conta no monorepo. Antes dela a regra estava
 * em quatro lugares — o diálogo de desconto (global e por item), a digitação do
 * preço unitário na linha do carrinho, o store do PDV e o hook de vendas do
 * admin — cada um com o seu arredondamento. O store nem arredondava, então o
 * total exibido no carrinho podia diferir do total gravado na venda.
 *
 * Um cupom de desconto é a QUARTA fonte de abatimento e entra por aqui, não por
 * um quinto lugar.
 */

/** Por que um desconto foi recusado. */
export type DiscountError = "invalido" | "negativo" | "excede-base";

/** Desconto aceito (em reais) ou o motivo da recusa. */
export type DiscountResult = { amount: number } | { error: DiscountError };

export interface DiscountInput {
  /** Valor sobre o qual o desconto incide — preço unitário, subtotal, etc. */
  base: number;
  /** Quanto o operador informou: reais quando `type` é "value", percentual quando é "percent". */
  value: number;
  type: "value" | "percent";
}

/**
 * Converte o desconto informado em reais, validando a faixa.
 *
 * O teto é a própria base: desconto maior que ela produziria valor negativo na
 * linha ou na venda. Zero é aceito de propósito — é como o operador remove um
 * desconto já aplicado.
 *
 * @param input Base, valor informado e tipo (reais ou percentual).
 * @returns `{ amount }` em reais, ou `{ error }` com o motivo da recusa.
 */
export function computeDiscount({ base, value, type }: DiscountInput): DiscountResult {
  if (Number.isNaN(value) || !Number.isFinite(value)) return { error: "invalido" };
  if (value < 0) return { error: "negativo" };

  const amount = round2(type === "percent" ? (base * value) / 100 : value);

  if (amount > round2(base)) return { error: "excede-base" };

  return { amount };
}

/** Um item do carrinho, no que importa para a conta. */
export interface SaleItemForTotals {
  /** Preço de tabela, ANTES do desconto do item. */
  unitPrice: number;
  quantity: number;
  /**
   * Desconto por UNIDADE, em reais.
   *
   * Unitário e não por linha: 2 reais de desconto em 3 unidades abatem 6 reais.
   * É assim que o backend registra o item (`unitPrice + discount` reconstrói o
   * preço de tabela do momento da venda) e mudar isso quebraria a auditoria.
   */
  unitDiscount: number;
}

/**
 * Item do carrinho no que importa para RATEAR o cupom entre as linhas.
 *
 * Acrescenta `productId` ao que os totais já pedem porque o desempate do resíduo
 * é por produto, não por posição na lista — ver `allocateCouponByItem`. É o
 * único lugar do cálculo que precisa saber QUAL produto é cada linha; por isso
 * `SaleItemForTotals` continua sem esse campo.
 */
export interface CouponAllocationItem extends SaleItemForTotals {
  productId: number;
}

export interface SaleTotalsInput {
  items: SaleItemForTotals[];
  /** Desconto concedido pelo operador sobre o total da venda. */
  globalDiscount?: number;
  /** Abatimento do cupom, aplicado depois do desconto global. */
  couponDiscount?: number;
}

export interface SaleTotals {
  /** Soma dos itens a preço de tabela, sem desconto nenhum. */
  grossSubtotal: number;
  /** Quanto os descontos por item abateram, já multiplicado pelas quantidades. */
  itemDiscountTotal: number;
  /** Base do desconto global: bruto menos os descontos de item. */
  subtotal: number;
  /** Desconto global efetivamente aplicado (pode ter sido limitado ao subtotal). */
  globalDiscount: number;
  /** Cupom efetivamente aplicado (pode ter sido limitado ao que sobrou). */
  couponDiscount: number;
  /** Soma de tudo que foi abatido. */
  discountTotal: number;
  /** O que o cliente paga. Nunca negativo. */
  total: number;
}

/**
 * Calcula os totais da venda com os descontos DISCRIMINADOS.
 *
 * A ordem de aplicação é item → global → cupom, e ela importa: um cupom de 40
 * reais numa venda de 100 com 20 de desconto global abate 40 sobre os 80 que
 * restaram, não sobre os 100 originais.
 *
 * Cada etapa é arredondada, não só o resultado — é o que garante que o número
 * exibido na tela seja o mesmo que vai no payload da venda e no cupom impresso.
 *
 * Descontos negativos são ignorados (viram zero) em vez de virarem acréscimo
 * silencioso, e cada desconto é limitado ao que ainda resta a pagar.
 *
 * @param input Itens do carrinho e os descontos a aplicar.
 */
export function computeSaleTotals({
  items,
  globalDiscount = 0,
  couponDiscount = 0,
}: SaleTotalsInput): SaleTotals {
  const grossSubtotal = round2(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const itemDiscountTotal = round2(
    items.reduce((sum, item) => sum + Math.max(0, item.unitDiscount) * item.quantity, 0),
  );
  const subtotal = round2(Math.max(0, grossSubtotal - itemDiscountTotal));

  const appliedGlobal = round2(Math.min(Math.max(0, globalDiscount), subtotal));
  const remainingAfterGlobal = round2(subtotal - appliedGlobal);
  const appliedCoupon = round2(Math.min(Math.max(0, couponDiscount), remainingAfterGlobal));

  return {
    grossSubtotal,
    itemDiscountTotal,
    subtotal,
    globalDiscount: appliedGlobal,
    couponDiscount: appliedCoupon,
    discountTotal: round2(itemDiscountTotal + appliedGlobal + appliedCoupon),
    total: round2(Math.max(0, remainingAfterGlobal - appliedCoupon)),
  };
}

/**
 * Subtotal LÍQUIDO do item — preço unitário já sem o desconto da linha, vezes a
 * quantidade.
 *
 * É a mesma base que `computeSaleTotals` usa (bruto menos desconto de item), e
 * ela precisa ser a mesma: se o rateio fosse proporcional ao preço de tabela, um
 * item com desconto próprio puxaria uma fatia do cupom maior do que o valor que
 * ele de fato representa na venda, e a margem por produto sairia errada
 * justamente no produto que já foi remarcado.
 */
function netSubtotal(item: SaleItemForTotals): number {
  const netUnitPrice = Math.max(0, item.unitPrice - Math.max(0, item.unitDiscount));
  return round2(Math.max(0, netUnitPrice * Math.max(0, item.quantity)));
}

/**
 * Índice do item de MAIOR subtotal; no empate, o de MENOR `productId`.
 *
 * O desempate por id, e não por posição, é o que torna o rateio reproduzível: a
 * mesma venda gravada a partir de listas em ordens diferentes — o carrinho
 * reordena, a fila offline serializa como quiser, o backend relê os itens do
 * banco na ordem que o índice devolver — produz o mesmo resultado. Desempatar
 * pelo primeiro da lista parece equivalente e não é: bastaria o carrinho estar
 * em outra ordem para o centavo do resíduo cair em outro produto, e o rateio
 * gravado deixaria de bater com o que o PDV calculou.
 *
 * A validação da venda já proíbe o mesmo produto em duas linhas, então o
 * desempate é sempre decidido.
 */
function indexOfLargestSubtotal(items: CouponAllocationItem[], subtotals: number[]): number {
  let largest = 0;
  for (let index = 1; index < subtotals.length; index++) {
    const wins =
      subtotals[index] > subtotals[largest] ||
      (subtotals[index] === subtotals[largest] && items[index].productId < items[largest].productId);

    if (wins) largest = index;
  }
  return largest;
}

/**
 * Rateia o abatimento do cupom entre os itens, proporcional ao subtotal de cada um.
 *
 * O cupom é concedido sobre a venda inteira, mas a margem por produto e o
 * `vDesc` por item da nota fiscal precisam saber quanto do abatimento coube a
 * cada linha. Sem o rateio, o relatório por produto soma o lucro bruto e o
 * cupom desaparece do custo — o produto parece mais rentável do que foi.
 *
 * **Por que existe resíduo.** Cada parcela é arredondada a 2 casas porque
 * centavo é a menor unidade que o banco grava (`numeric(18,2)`) e que o
 * comprovante imprime. A soma das parcelas arredondadas quase nunca reproduz o
 * cupom: 10,00 sobre itens de 33,33 / 33,33 / 33,34 dá três parcelas de 3,33 e
 * sobra 1 centavo. Sem devolver essa sobra a algum item, a soma dos
 * `sale_items.coupon_discount` deixaria de reproduzir `sales.coupon_discount` e
 * o `CHECK` do banco passaria a mentir. O resíduo é da ordem de 1 a 2 centavos e
 * pode ser negativo, quando o arredondamento distribuiu a mais.
 *
 * **Por que o resíduo vai no item de maior subtotal, e não "no último do laço".**
 * Jogá-lo no último item torna o resultado dependente da ORDEM da lista: o mesmo
 * carrinho, reordenado na tela ou lido do IndexedDB em outra sequência, geraria
 * um rateio diferente, o teste de paridade com o C# ficaria instável e a
 * segunda via do comprovante poderia sair diferente da primeira. Escolhido por
 * regra — maior subtotal, empate pelo menor índice — o resultado é o mesmo em
 * qualquer ordem, e o centavo cai onde ele menos distorce a margem percentual.
 *
 * O backend reimplementa este mesmo algoritmo em C#, com o mesmo desempate e o
 * mesmo arredondamento meio-para-cima. Divergir aqui não quebraria nada de
 * imediato — a soma continua fechando dos dois lados — mas o centavo do resíduo
 * cairia em produtos diferentes no PDV e no banco, e a margem por produto do
 * relatório deixaria de reproduzir o que a venda calculou.
 *
 * @param items Itens do carrinho, na ordem em que serão gravados.
 * @param couponDiscount Cupom efetivamente aplicado — o `couponDiscount` que
 * `computeSaleTotals` devolveu, já limitado ao que restava a pagar.
 * @returns Uma parcela por item, na MESMA ordem da entrada, somando exatamente
 * `couponDiscount`.
 */
export function allocateCouponByItem(items: CouponAllocationItem[], couponDiscount: number): number[] {
  const shares = items.map(() => 0);
  if (shares.length === 0) return shares;

  // Cupom negativo ou ilegível vira zero, como em `computeSaleTotals`: virar
  // acréscimo silencioso na linha do item seria pior que não ratear.
  const target = Number.isFinite(couponDiscount) && couponDiscount > 0 ? round2(couponDiscount) : 0;
  if (target === 0) return shares;

  const subtotals = items.map(netSubtotal);
  const base = round2(subtotals.reduce((sum, subtotal) => sum + subtotal, 0));

  // Base zero (venda inteiramente zerada por desconto de item) não tem proporção
  // a seguir. As parcelas ficam em zero e o resíduo — o cupom inteiro — cai no
  // primeiro item pelo desempate. Preservar a soma importa mais que a proporção:
  // é ela que o `CHECK` do banco confere. Na prática `computeSaleTotals` já teria
  // zerado o cupom nesse caso, porque não sobrou nada a pagar.
  if (base > 0) {
    for (let index = 0; index < subtotals.length; index++) {
      shares[index] = round2((target * subtotals[index]) / base);
    }
  }

  const allocated = round2(shares.reduce((sum, share) => sum + share, 0));
  const residual = round2(target - allocated);
  const largest = indexOfLargestSubtotal(items, subtotals);
  shares[largest] = round2(shares[largest] + residual);

  return shares;
}
