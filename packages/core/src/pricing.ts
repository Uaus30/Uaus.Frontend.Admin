import { round2 } from "./money";

/**
 * Precificação: margem, markup e preço sugerido a partir do custo.
 *
 * Mora no `core` porque a entrada de estoque do admin (duas modais) e, amanhã,
 * a tela de compras precisam responder à MESMA pergunta — "a que preço eu vendo
 * isto?" — e duas contas de margem que divergem num centavo são a receita do
 * "o sistema mostra uma margem na entrada e outra no relatório".
 *
 * Vocabulário, porque os dois termos se confundem no balcão:
 *
 * - **Margem** é a fatia do PREÇO que fica de lucro: `(preço − custo) / preço`.
 *   É a que o relatório de inventário e o painel exibem.
 * - **Markup** é quanto o CUSTO foi multiplicado: `(preço − custo) / custo`.
 *   Custo 10 vendido a 15 tem margem de 33,3% e markup de 50%.
 */

/** Margem alvo da loja para a sugestão de preço, em pontos percentuais. */
export const DEFAULT_TARGET_MARGIN_PERCENT = 40;

/**
 * Passo do preço sugerido, em reais: a sugestão sai em múltiplos de 10
 * centavos ("R$ 16,70", nunca "R$ 16,67"), que é como a etiqueta é escrita.
 */
export const SUGGESTED_PRICE_STEP = 0.1;

/** Um valor monetário informado é utilizável na conta? */
function isUsable(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Margem de lucro sobre o preço de venda, em pontos percentuais (0 a 100 em
 * venda com lucro; negativa quando se vende abaixo do custo).
 *
 * @param cost Custo unitário.
 * @param price Preço de venda.
 * @returns A margem, ou `null` quando não há preço para dividir.
 */
export function marginPercent(cost: number, price: number): number | null {
  if (!isUsable(price) || !Number.isFinite(cost) || cost < 0) return null;
  return round2(((price - cost) / price) * 100);
}

/**
 * Markup sobre o custo, em pontos percentuais.
 *
 * @param cost Custo unitário.
 * @param price Preço de venda.
 * @returns O markup, ou `null` quando não há custo — brinde e bonificação
 *   entram a custo zero, e dividir por zero não é "markup infinito", é "não se
 *   aplica".
 */
export function markupPercent(cost: number, price: number): number | null {
  // Sem preço não há markup a mostrar: com zero a conta daria -100%, que na
  // tela parecia um markup negativo real em vez de "preço ainda não informado".
  if (!isUsable(cost) || !isUsable(price)) return null;
  return round2(((price - cost) / cost) * 100);
}

/**
 * Preço que entrega a margem alvo, arredondado ao múltiplo de `step` mais
 * PRÓXIMO.
 *
 * Mais próximo, e não para cima: a regra da loja é "algo próximo de 40%", e
 * arredondar sempre para cima deixaria a sugestão sistematicamente acima da
 * margem pedida. Custo 10 dá 16,666… → 16,70 (40,1%); custo 3,50 dá 5,833… →
 * 5,80 (39,7%).
 *
 * @param cost Custo unitário.
 * @param targetMarginPercent Margem desejada, em pontos percentuais (0 a 99,99).
 * @param step Múltiplo em reais para o arredondamento.
 * @returns O preço sugerido, ou `null` sem custo — não há o que sugerir para um
 *   brinde, e sugerir zero zeraria o preço do produto no cadastro.
 */
export function suggestedPrice(
  cost: number,
  targetMarginPercent: number = DEFAULT_TARGET_MARGIN_PERCENT,
  step: number = SUGGESTED_PRICE_STEP,
): number | null {
  if (!isUsable(cost)) return null;
  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent >= 100)
    return null;
  if (!isUsable(step)) return null;

  const raw = cost / (1 - targetMarginPercent / 100);
  // O EPSILON pelo mesmo motivo do `round2`: 16.65 / 0.1 dá 166.49999… em
  // binário, e o `Math.round` cru cairia para o lado errado do meio.
  const steps = Math.round(raw / step + Number.EPSILON);
  return round2(steps * step);
}
