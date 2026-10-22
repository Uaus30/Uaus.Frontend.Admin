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
 * Abaixo desta margem o preço é considerado APERTADO (amarelo-limão na tela).
 * Entre ela e a margem alvo, a venda dá lucro, mas menos do que a loja pratica.
 */
export const TIGHT_MARGIN_PERCENT = 30;

/**
 * Abaixo desta margem o preço é FINO (laranja); abaixo dela, BAIXO (vermelho),
 * que inclui o prejuízo. O quarto degrau é de 22/10/2026.
 */
export const THIN_MARGIN_PERCENT = 20;

/**
 * Como a margem de um preço se classifica, da melhor para a pior. A cor de cada
 * faixa é escolha da tela (`apps/admin/src/lib/margin-tone.ts`).
 */
export type MarginBand = "healthy" | "tight" | "thin" | "low";

/**
 * Em que faixa a margem cai: saudável (>= 40%), apertada (30% a 40%), fina
 * (20% a 30%) ou baixa (< 20%, incluindo prejuízo).
 *
 * Os cortes são a regra do dono e moram aqui, e não na tela, para toda tela que
 * mostra margem — entrada de estoque, compras, recebimento, cadastro de produto,
 * promoções e os relatórios de BI — pintar a MESMA margem da mesma cor. Eram três
 * faixas (05/09/2026, vermelho abaixo de 30%); em 22/10/2026 o dono separou o
 * vermelho em dois, porque 25% e 5% não pedem a mesma reação: laranja de 20% a
 * 30%, vermelho abaixo de 20%.
 *
 * @param margin Margem em pontos percentuais, ou `null` quando não há preço.
 * @returns A faixa, ou `null` quando não há margem a classificar.
 */
export function marginBand(margin: number | null): MarginBand | null {
  if (margin === null || !Number.isFinite(margin)) return null;
  if (margin >= DEFAULT_TARGET_MARGIN_PERCENT) return "healthy";
  if (margin >= TIGHT_MARGIN_PERCENT) return "tight";
  if (margin >= THIN_MARGIN_PERCENT) return "thin";
  return "low";
}

/**
 * O teto do preço de venda da loja, em reais (22/10/2026): a Uaus é "tudo até
 * R$ 30". O backend recusa acima disso (`SalePriceLimit`); aqui ele limita a
 * SUGESTÃO de preço e avisa antes do salvar.
 */
export const MAX_SALE_PRICE = 30;

/**
 * O preço sugerido pela margem alvo, sem passar do teto da loja.
 *
 * Custo de R$ 20 pede R$ 33,40 para 40% de margem — e a loja não vende acima de
 * R$ 30. A sugestão para no teto, e a margem que sobra aparece na cor dela.
 *
 * @returns O preço sugerido limitado a {@link MAX_SALE_PRICE}, ou `null` sem custo.
 */
export function suggestedSalePrice(cost: number): number | null {
  const sugerido = suggestedPrice(cost);
  return sugerido === null ? null : Math.min(sugerido, MAX_SALE_PRICE);
}

/** O preço passa do teto da loja? Zero (em branco) não passa. */
export function exceedsMaxSalePrice(price: number): boolean {
  return Number.isFinite(price) && price > MAX_SALE_PRICE;
}

/**
 * O preço fica ABAIXO do custo — margem negativa?
 *
 * A loja permite (o custo pode passar do teto de R$ 30, e o desconto do
 * fornecedor nem sempre traz para baixo dele), mas a tela pede confirmação antes
 * de gravar: é o tipo de número que só se digita por engano ou de propósito, e a
 * pergunta separa os dois. Preço em branco (zero) ou custo desconhecido não
 * contam — sem os dois não há margem.
 */
export function isBelowCost(cost: number, price: number): boolean {
  return Number.isFinite(cost) && cost > 0 && Number.isFinite(price) && price > 0 && price < cost;
}

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
 * Preço que entrega a margem alvo, arredondado ao múltiplo de `step` PARA CIMA.
 *
 * Para cima, e não para o mais próximo (como era até 05/09/2026): arredondando
 * para baixo a sugestão entregava MENOS que a margem pedida — custo 8,90 dava
 * 14,80, que é 39,9%, e a tela dizia "40% de margem". Subindo, o sugerido
 * nunca fica abaixo do alvo: 8,90 → 14,90 (40,3%), 3,50 → 5,90 (40,7%).
 *
 * O `toFixed(6)` antes do `ceil` existe por causa do binário: 6 ÷ 0,6 dá
 * 9,999999999999998, e o `ceil` cru transformaria um resultado exato de R$ 10
 * em R$ 10,10.
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
  const steps = Math.ceil(Number((raw / step).toFixed(6)));
  return round2(steps * step);
}
