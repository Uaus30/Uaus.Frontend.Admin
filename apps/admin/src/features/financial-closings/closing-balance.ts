import { formatCurrency, round2 } from "@workspace/core";
import type {
  FinancialClosingShareDto,
  FinancialClosingWithdrawalPayload,
} from "@workspace/api-client-react";

/**
 * O passo 3 do fechamento — retiradas e saldo (PLANO-FINANCEIRO.md, seção 3.2).
 *
 * Os números da conta vêm sempre do servidor (a prévia); daqui sai só o que é
 * leitura do que a pessoa digitou: o valor de cada campo, as retiradas por
 * sócio e a conferência do saldo confirmado contra o calculado.
 */

/** Diferença acima disto, para mais ou para menos, pede observação. */
export const BALANCE_TOLERANCE = 1;

/** Tamanho máximo da observação da diferença — o `varchar(300)` da coluna. */
export const BALANCE_NOTES_MAX_LENGTH = 300;

/** O que um campo de valor diz: vazio ("não informou"), ilegível, ou um número. */
export type AmountField = { kind: "empty" } | { kind: "invalid" } | { kind: "value"; value: number };

/**
 * Lê um campo de valor separando "não informou" de "digitou bobagem" — a
 * armadilha 3 do CLAUDE.md (`Number("")` é zero, e o vazio viraria R$ 0,00).
 * Aceita o ponto do `<input type="number">` e a vírgula de quem digitar à mão.
 */
export function parseAmountField(text: string): AmountField {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "empty" };
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? { kind: "value", value: round2(value) } : { kind: "invalid" };
}

/** O texto digitado de cada sócio, pelo id. Vazio vale zero: retirar nada é resposta. */
export type WithdrawalDrafts = Record<number, string>;

/**
 * As retiradas do rascunho, uma por sócio.
 *
 * @returns `null` quando alguma é ilegível ou negativa — aí nada vai ao
 * servidor, e o campo aparece com erro.
 */
export function withdrawalsFromDrafts(drafts: WithdrawalDrafts): FinancialClosingWithdrawalPayload[] | null {
  const withdrawals: FinancialClosingWithdrawalPayload[] = [];
  for (const [partnerId, text] of Object.entries(drafts)) {
    const field = parseAmountField(text);
    if (field.kind === "invalid" || (field.kind === "value" && field.value < 0)) return null;
    withdrawals.push({ partnerId: Number(partnerId), amount: field.kind === "value" ? field.value : 0 });
  }
  return withdrawals;
}

/** As duas listas dizem as mesmas retiradas? Zero e ausente são iguais. */
export function sameWithdrawals(
  first: readonly FinancialClosingWithdrawalPayload[],
  second: readonly FinancialClosingWithdrawalPayload[],
): boolean {
  const relevant = (list: readonly FinancialClosingWithdrawalPayload[]) =>
    new Map(list.filter((item) => item.amount !== 0).map((item) => [item.partnerId, item.amount]));
  const a = relevant(first);
  const b = relevant(second);
  return a.size === b.size && [...a].every(([partnerId, amount]) => b.get(partnerId) === amount);
}

/**
 * Uma retirada por sócio do rateio, com zero para quem não retirou — o contrato
 * pede uma por sócio ativo, e é o rateio da prévia que diz quem são.
 */
export function withdrawalsForShares(
  shares: readonly Pick<FinancialClosingShareDto, "partnerId">[],
  withdrawals: readonly FinancialClosingWithdrawalPayload[],
): FinancialClosingWithdrawalPayload[] {
  const byPartner = new Map(withdrawals.map((item) => [item.partnerId, item.amount]));
  return shares.map((share) => ({ partnerId: share.partnerId, amount: byPartner.get(share.partnerId) ?? 0 }));
}

/** A conferência do saldo confirmado contra o calculado. */
export interface BalanceCheck {
  /** O saldo confirmado digitado; `null` vazio ou ilegível. */
  confirmed: number | null;
  /** Confirmado − calculado; `null` sem um dos dois (implantação sem saldo inicial). */
  difference: number | null;
  /** A diferença passa de R$ 1,00: a observação é obrigatória. */
  notesRequired: boolean;
  /** Saldo confirmado negativo — aceito, com aviso (decisão F). */
  negative: boolean;
  /** O que falta para confirmar, por extenso; `null` quando pode. */
  problem: string | null;
}

/**
 * Confere o saldo confirmado: obrigatório, e com observação quando difere do
 * calculado em mais de R$ 1,00. A diferença costuma ser taxa de cartão, venda
 * no cartão que ainda não caiu, despesa que não passou pelo sistema ou erro de
 * lançamento — e um saldo chutado carregaria o erro para todos os meses
 * seguintes. O servidor confere de novo na confirmação.
 */
export function checkBalance(
  calculated: number | null | undefined,
  confirmedText: string,
  notes: string,
): BalanceCheck {
  const field = parseAmountField(confirmedText);
  const confirmed = field.kind === "value" ? field.value : null;
  const difference = confirmed !== null && calculated != null ? round2(confirmed - calculated) : null;
  const notesRequired = difference !== null && Math.abs(difference) > BALANCE_TOLERANCE;

  let problem: string | null = null;
  if (field.kind === "empty")
    problem = "Informe o saldo confirmado: o dinheiro, a conta e o Pix no fim do mês.";
  else if (field.kind === "invalid") problem = "O saldo confirmado não é um valor válido.";
  else if (notesRequired && !notes.trim())
    problem = `Explique a diferença de ${formatCurrency(difference ?? 0)} entre o saldo confirmado e o calculado.`;

  return { confirmed, difference, notesRequired, negative: confirmed !== null && confirmed < 0, problem };
}

/** O texto que o campo de saldo mostra para um número do servidor (ponto decimal, como o `type="number"`). */
export function amountInputText(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}
