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
  const grossSubtotal = round2(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
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
