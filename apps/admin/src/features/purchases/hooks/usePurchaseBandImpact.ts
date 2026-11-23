import { useGetPurchaseBudget } from "@workspace/api-client-react";
import { parseMonthKey } from "@workspace/core";
import {
  purchaseBandImpact,
  purchaseMoneyDelta,
  purchaseMoneyValue,
  type PurchaseMoney,
} from "../lib/purchase-band-impact";
import type { PurchaseForm } from "../types";

interface UsePurchaseBandImpactParams {
  /** A modal está aberta — fechada, não há o que consultar. */
  open: boolean;
  /** Compra lançada abre em leitura: não muda mais nada. */
  readOnly: boolean;
  form: Pick<PurchaseForm, "status" | "purchaseDate" | "grossTotal" | "finalTotal">;
  /** O que a compra gravada valia; `null` na compra nova. */
  original: PurchaseMoney | null;
}

/**
 * A faixa de compras do mês da data da compra, com a compra simulada.
 *
 * Só consulta quando a compra muda K: A caminho com valor, e com valor
 * diferente do que já contava. Pendente não mexe na faixa, e abrir uma compra
 * só para conferir não é motivo para perguntar nada ao servidor.
 */
export function usePurchaseBandImpact({ open, readOnly, form, original }: UsePurchaseBandImpactParams) {
  const current: PurchaseMoney = {
    monthKey: form.purchaseDate.slice(0, 7),
    value: purchaseMoneyValue(Number(form.status), form.grossTotal, form.finalTotal),
  };
  const enabled =
    open &&
    !readOnly &&
    current.value > 0 &&
    purchaseMoneyDelta(original, current) !== 0 &&
    parseMonthKey(current.monthKey) !== null;

  const { data } = useGetPurchaseBudget({ month: current.monthKey }, { query: { enabled } });

  return enabled ? purchaseBandImpact(data, original, current) : null;
}
