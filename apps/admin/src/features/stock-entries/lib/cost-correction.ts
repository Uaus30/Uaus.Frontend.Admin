import { formatCurrency, formatShortDate, marginPercent, parseAmount, round2 } from "@workspace/core";
import type {
  PurchaseEntryCostCorrectionDto,
  ReceivedPurchaseEntryItemDto,
} from "@workspace/api-client-react";

/** Número com um separador decimal só, vírgula ou ponto — nada antes, nada depois. */
const CUSTO_DIGITADO = /^\d+([.,]\d+)?$/;

/**
 * Valida o custo digitado na correção.
 *
 * - **Campo vazio NÃO é zero** aqui, ao contrário de `parseAmountOrNull`: apagar
 *   o campo e salvar zeraria o custo do lote e de todas as vendas que o
 *   consumiram. Zero de verdade (bonificação) se digita.
 * - **O ponto é decimal**, como no teclado numérico. O `parseAmount` do core lê
 *   ponto como milhar, e "3.70" viraria R$ 370,00 — justo o erro de uma casa que
 *   a correção existe para desfazer (a JARRA de 13/09/2026 foi 37,00 por 3,70).
 *   Na mesma aba, o `CurrencyInput` troca ponto por vírgula e a Contagem Física
 *   usa campo numérico: o operador digita com ponto e espera o decimal.
 * - **Sobra de texto é recusada**, e não cortada: "3,7abc" é engano de
 *   digitação, e cortar gravaria um custo que ninguém confirmou.
 *
 * @returns O custo, ou a frase do erro.
 */
export function parseCorrectedCost(texto: string): { value: number } | { error: string } {
  const limpo = texto.trim();
  if (!limpo) return { error: "Informe o custo unitário." };
  if (!CUSTO_DIGITADO.test(limpo)) return { error: "Custo unitário inválido. Use só número, como 3,70." };

  return { value: round2(parseAmount(limpo.replace(".", ","))) };
}

/**
 * O que a correção vai fazer, dito ANTES de confirmar. Quem corrige o custo na
 * aba Estoque não está vendo as vendas — e é nelas que o lucro muda.
 */
export function describeCostCorrectionImpact(
  item: ReceivedPurchaseEntryItemDto,
  purchaseId?: number | null,
): string {
  const saiu = Math.max(0, item.quantity - item.availableQuantity);
  const consumo =
    saiu > 0
      ? `${saiu === 1 ? "A unidade que já saiu" : `As ${saiu} unidades que já saíram`} desta entrada (vendas e baixas) ` +
        `${saiu === 1 ? "tem" : "têm"} o custo refeito, e o lucro dessas vendas muda.`
      : "Nenhuma unidade desta entrada saiu ainda.";
  const compra =
    purchaseId != null ? ` A compra #${purchaseId} também não muda: os totais dela são o que foi pago.` : "";

  return `O custo do lote e o do cadastro passam a ser este. ${consumo} A quantidade, o preço e o valor das vendas não mudam.${compra}`;
}

/** A margem antes e depois da correção, sobre o preço de venda do cadastro. */
export type CostCorrectionMargin = {
  /** Preço de venda ATUAL do cadastro — a base das duas margens. */
  price: number;
  /** Margem com o custo de agora; `null` quando o custo de agora é zero. */
  before: number | null;
  /** Margem com o custo corrigido. */
  after: number;
};

/**
 * A margem que a correção produz, para a confirmação mostrar o efeito no preço
 * (pedido do dono, 23/09/2026): quem corrige o custo quer saber se o preço ainda
 * dá lucro.
 *
 * O preço é o de AGORA: `productPrice` vem do cadastro do produto, não da nota.
 * Sem preço, ou com o custo corrigido zerado (bonificação), não há margem que
 * ajude, e volta `null` — "100%" de um brinde seria enganoso, a mesma razão da
 * prévia da entrada. O custo de agora zerado é a anomalia que a correção existe
 * para desfazer: ele não entra como "de 100%", só a margem nova aparece.
 */
export function describeCostCorrectionMargin(
  item: Pick<ReceivedPurchaseEntryItemDto, "unitCost" | "productPrice">,
  unitCost: number,
): CostCorrectionMargin | null {
  if (!(unitCost > 0)) return null;

  const after = marginPercent(unitCost, item.productPrice);
  if (after === null) return null;

  const before = item.unitCost > 0 ? marginPercent(item.unitCost, item.productPrice) : null;
  return { price: item.productPrice, before, after };
}

/** O resultado, para o toast: quanto foi refeito, e não só "salvo". */
export function describeCostCorrectionResult(resultado: PurchaseEntryCostCorrectionDto): string {
  if (!resultado.changed) return "O custo informado já era o gravado — nada mudou.";

  const vendas = resultado.saleItemsUpdated;
  const baixas = resultado.writeOffItemsUpdated;
  const refeitos =
    vendas + baixas === 0
      ? "Nenhuma venda tinha consumido esta entrada."
      : `Custo refeito em ${vendas} ${vendas === 1 ? "item de venda" : "itens de venda"}` +
        (baixas > 0 ? ` e ${baixas} ${baixas === 1 ? "item de baixa" : "itens de baixa"}` : "") +
        ".";

  return `De ${formatCurrency(resultado.previousUnitCost)} para ${formatCurrency(resultado.unitCost)} por unidade. ${refeitos}`;
}

/**
 * Aviso dos fechamentos assinados que cobrem vendas refeitas. O fechamento é um
 * documento congelado: o CMV dele continua com o custo antigo, e reabrir é
 * decisão do dono — a tela só avisa. Nulo quando não há nenhum.
 */
export function describeAffectedClosings(resultado: PurchaseEntryCostCorrectionDto): string | null {
  const fechamentos = resultado.affectedClosings;
  if (fechamentos.length === 0) return null;

  const periodos = fechamentos
    .map((f) => `${formatShortDate(f.periodStart)} a ${formatShortDate(f.periodEnd)}`)
    .join("; ");
  const quantos =
    fechamentos.length === 1 ? "O fechamento assinado" : `Os ${fechamentos.length} fechamentos assinados`;

  return `${quantos} de ${periodos} ${fechamentos.length === 1 ? "continua" : "continuam"} com o custo antigo no CMV. Reabrir é decisão sua.`;
}
