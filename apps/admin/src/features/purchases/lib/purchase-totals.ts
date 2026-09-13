import { marginPercent, round2 } from "@workspace/core";
import type { PurchaseDto } from "../types";

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

/**
 * A margem prevista de uma compra, em pontos percentuais, ou `null`.
 *
 * É a coluna que substituiu o "Total final" na listagem (13/09/2026): o total é
 * a soma de um pedido cujo tamanho varia, e R$ 1.500 ao lado de R$ 30 não diz
 * qual compra foi melhor. A margem diz.
 *
 * O custo é o unitário final — o mesmo que a entrada vai gravar no lote. O preço
 * é o **sugerido na compra**, porque é ali que o preço de venda é decidido; sem
 * ele, o preço que o produto já tem, que é o que a loja cobra hoje e contra o
 * qual o custo recém-negociado se compara.
 *
 * `null` — traço na tela, nunca zero — em três casos legítimos: compra pendente
 * anotada sem custo, compra de produto novo sem preço decidido, e compra com
 * VARIAÇÕES sem preço sugerido, onde o cabeçalho não aponta para nenhuma delas e
 * o preço de uma não responde pela compra. Zero leria como "vende no custo", que
 * é uma afirmação que ninguém fez.
 */
export function purchaseMarginPercent(purchase: PurchaseDto): number | null {
  const price = purchase.suggestedPrice || purchase.productPrice || 0;
  if (price <= 0 || purchase.unitFinal <= 0) return null;
  return marginPercent(purchase.unitFinal, price);
}
