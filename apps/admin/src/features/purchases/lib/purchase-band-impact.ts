import { PURCHASE_STATUS, type PurchaseBudgetDto } from "@workspace/api-client-react";
import { purchaseBandFor, round2, type PurchaseBand } from "@workspace/core";

/**
 * O efeito de UMA compra na faixa de compras do mês, antes de gravá-la.
 *
 * A faixa do mês vem do servidor (`GET /PurchaseBudget`), e K — as compras
 * pagas — já inclui esta compra quando ela já contava. Aqui entra só a
 * DIFERENÇA que a edição produz, e a faixa resultante sai da mesma regra do
 * core (`purchaseBandFor`) que o backend aplica no domínio.
 *
 * O que conta em K (seção 4 do plano): compra A caminho ou Lançado, pela data
 * da compra, pelo total final — o bruto, se faltar o final. Pendente não conta:
 * é "preciso comprar isto".
 */

/** O que a compra põe em K, e em qual mês. Valor zero = não conta. */
export interface PurchaseMoney {
  /** Mês da data da compra, `"yyyy-MM"`. */
  monthKey: string;
  value: number;
}

/** A compra vista pela faixa: em que faixa o mês fica com ela, e o que sobra. */
export interface PurchaseBandImpact {
  monthKey: string;
  /** O mês da data já foi fechado: a compra não muda o fechamento. */
  closedMonth: boolean;
  provisional: boolean;
  before: PurchaseBand;
  after: PurchaseBand;
  greenRoomAfter: number;
  redRoomAfter: number;
  /**
   * A compra põe dinheiro novo num mês que fica no vermelho: pede confirmação
   * (decisão 13 — confirmação, nunca bloqueio). Mês fechado não pergunta: ali a
   * faixa é história, e a compra não muda o fechamento.
   */
  leadsToRed: boolean;
}

/**
 * Quanto a compra vale em K: o total final, ou o bruto quando o final falta.
 * Zero fora de A caminho e Lançado — Pendente não é dinheiro que saiu.
 */
export function purchaseMoneyValue(status: number, grossTotal: number, finalTotal: number): number {
  if (status !== PURCHASE_STATUS.InTransit && status !== PURCHASE_STATUS.Received) return 0;
  return finalTotal > 0 ? finalTotal : grossTotal;
}

/**
 * Quanto a edição muda K no mês da data: o valor de agora menos o que a compra
 * gravada já punha NAQUELE mês. A compra que troca de mês conta inteira no novo.
 */
export function purchaseMoneyDelta(original: PurchaseMoney | null, current: PurchaseMoney): number {
  const alreadyCounted = original && original.monthKey === current.monthKey ? original.value : 0;
  return round2(current.value - alreadyCounted);
}

/**
 * A faixa do mês com esta compra.
 *
 * A linha aparece quando a compra PASSA a valer dinheiro, ou muda o quanto
 * vale (seção 7.3): criada já como A caminho, mudada de Pendente para A
 * caminho, ou com o total alterado numa compra que já contava. A compra que
 * troca de mês conta inteira no mês novo.
 *
 * @param budget A faixa do mês da data da compra; indefinida enquanto carrega.
 * @param original O que a compra gravada valia (`null` na compra nova).
 * @param current O que ela vale com o formulário de agora.
 * @returns `null` quando não há linha a mostrar: a compra não conta, nada
 *   mudou, ou a faixa do mês ainda não chegou (e aí também não se pergunta
 *   nada — a faixa avisa, nunca trava a gravação).
 */
export function purchaseBandImpact(
  budget: PurchaseBudgetDto | undefined,
  original: PurchaseMoney | null,
  current: PurchaseMoney,
): PurchaseBandImpact | null {
  if (!budget || current.value <= 0) return null;
  // A consulta do mês novo ainda não respondeu: a resposta à mão é de outro mês.
  if (budget.month.slice(0, 7) !== current.monthKey) return null;

  const delta = purchaseMoneyDelta(original, current);
  if (delta === 0) return null;

  const spentAfter = round2(budget.purchasesPaid + delta);
  const after = purchaseBandFor(spentAfter, budget.greenLimit, budget.redLimit);

  return {
    monthKey: current.monthKey,
    closedMonth: budget.isClosedMonth,
    provisional: budget.isProvisional,
    before: purchaseBandFor(budget.purchasesPaid, budget.greenLimit, budget.redLimit),
    after,
    greenRoomAfter: round2(budget.greenLimit - spentAfter),
    redRoomAfter: round2(budget.redLimit - spentAfter),
    leadsToRed: !budget.isClosedMonth && delta > 0 && after === "red",
  };
}
