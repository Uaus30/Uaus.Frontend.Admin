/**
 * Mês de calendário como chave `yyyy-MM` — a competência do financeiro.
 *
 * O financeiro da loja é mensal (fechamento, faixa de compras, aportes), e a API
 * fala de mês como `"yyyy-MM"` (`?month=2026-11`). Estas funções convertem entre
 * a chave, o par ano/mês e o texto da tela sem passar por `Date` ao LER: a data
 * da API `"2026-11-01"` lida por `new Date()` vira meia-noite UTC e volta para
 * 31/10 no Brasil (armadilha 2 do CLAUDE.md). Quem lê os dígitos da string não
 * tem fuso para errar.
 *
 * Mora no `core` porque o Painel Financeiro, os Aportes, a tela de Compras, o
 * Dashboard e os Fechamentos escrevem e leem o mesmo mês — uma cópia por tela é
 * como "novembro" acaba virando "Novembro de 2026" numa e "nov/2026" na outra.
 */

/** Nomes dos meses em pt-BR — índice 0 = janeiro. */
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** Ano e mês (1–12, não o índice do `Date`). */
export interface YearMonth {
  year: number;
  month: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Nome do mês (1–12) em pt-BR, com inicial maiúscula: "Novembro". Vazio fora de 1–12. */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** A chave `yyyy-MM` de um par ano/mês. */
export function monthKeyOf({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`;
}

/**
 * A chave `yyyy-MM` de uma data, pelos componentes LOCAIS.
 *
 * Nunca `toISOString().slice(0, 7)`: às 22h do dia 30 em Brasília o UTC já é o
 * dia 1º do mês seguinte, e a tela abriria no mês errado.
 */
export function toMonthKey(date: Date): string {
  return monthKeyOf({ year: date.getFullYear(), month: date.getMonth() + 1 });
}

/**
 * Ano e mês de uma chave `yyyy-MM` ou de uma data da API (`2026-11-01`,
 * `2026-11-01T00:00:00`), lidos direto dos dígitos.
 *
 * @returns `null` quando o texto não começa por `yyyy-MM` ou o mês sai de 1–12.
 */
export function parseMonthKey(value: string | null | undefined): YearMonth | null {
  const match = /^(\d{4})-(\d{2})/.exec(value ?? "");
  if (!match) return null;

  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return { year: Number(match[1]), month };
}

/** "Novembro de 2026". Vazio quando a chave é ilegível. */
export function formatMonthKey(value: string | null | undefined): string {
  const parsed = parseMonthKey(value);
  return parsed ? `${monthName(parsed.month)} de ${parsed.year}` : "";
}

/** Só o nome do mês da chave: "Novembro". Vazio quando a chave é ilegível. */
export function monthNameOf(value: string | null | undefined): string {
  const parsed = parseMonthKey(value);
  return parsed ? monthName(parsed.month) : "";
}

/**
 * Primeiro e último dia do mês, em `yyyy-MM-dd` — o período que um filtro de
 * datas da API recebe.
 *
 * `new Date(ano, mês, 0)` é o dia 0 do mês seguinte, ou seja, o último deste:
 * resolve fevereiro e ano bissexto sem tabela. Só ESCREVE com `Date`, nunca lê.
 */
export function monthKeyRange(value: string | null | undefined): { start: string; end: string } | null {
  const parsed = parseMonthKey(value);
  if (!parsed) return null;

  const key = monthKeyOf(parsed);
  const lastDay = new Date(parsed.year, parsed.month, 0).getDate();
  return { start: `${key}-01`, end: `${key}-${pad(lastDay)}` };
}

/**
 * Desloca a chave em `delta` meses: `shiftMonthKey("2026-01", -1)` é `"2025-12"`.
 *
 * Conta pelo índice absoluto do mês (`ano × 12 + mês`), e não pelo `setMonth` do
 * `Date`, que pula meses quando o dia não existe no destino (31/01 + 1 = 03/03).
 *
 * @returns A própria entrada quando ela é ilegível — não há mês para deslocar.
 */
export function shiftMonthKey(value: string, delta: number): string {
  const parsed = parseMonthKey(value);
  if (!parsed) return value;

  const index = parsed.year * 12 + (parsed.month - 1) + delta;
  return monthKeyOf({ year: Math.floor(index / 12), month: (index % 12) + 1 });
}
