import { round2 } from "@workspace/core";

/** Os derivados dos totais da compra, como a tela os mostra enquanto digita. */
export interface PurchaseDerivedTotals {
  /** Bruto ÷ quantidade. */
  unitGross: number;
  /** Final ÷ quantidade — o custo unitário que a entrada vai gravar. */
  unitFinal: number;
  /** (Final − Bruto) ÷ Bruto em %. Negativo é desconto; positivo, acréscimo. Zero sem bruto. */
  adjustmentPercent: number;
}

/**
 * Deriva unitários e percentual dos totais digitados.
 *
 * É a MESMA conta do backend (`PurchaseService.Project`), repetida aqui só para
 * a prévia enquanto o operador digita — o valor gravado é o do servidor. Se as
 * duas divergirem num centavo, o que vale é o que a listagem mostra depois de
 * salvar; esta é a prévia.
 */
export function derivePurchaseTotals(
  quantity: number,
  grossTotal: number,
  finalTotal: number,
): PurchaseDerivedTotals {
  const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const gross = Number.isFinite(grossTotal) && grossTotal >= 0 ? grossTotal : 0;
  const final = Number.isFinite(finalTotal) && finalTotal >= 0 ? finalTotal : 0;

  return {
    unitGross: qty > 0 ? round2(gross / qty) : 0,
    unitFinal: qty > 0 ? round2(final / qty) : 0,
    adjustmentPercent: gross > 0 ? round2(((final - gross) / gross) * 100) : 0,
  };
}
