/**
 * Competência do fechamento financeiro: mês + ano.
 *
 * O fechamento deixou de ser um período livre e passou a ser um mês-calendário
 * inteiro — que é o que os custos fixos já assumiam (competência mensal, valor
 * cheio de cada mês tocado, sem pró-rata). Período continua sendo o que o
 * backend grava; aqui está a conversão de mão dupla entre os dois mundos.
 *
 * Nada neste arquivo passa por `Date` ao ler datas vindas da API: `new Date("2026-08-01")`
 * é interpretado como UTC e volta 31/07 no Brasil (armadilha 2 do CLAUDE.md).
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

/** Quantos anos o select oferece, contando o atual. */
const YEAR_SPAN = 5;

/** Mês (1–12) e ano de um fechamento. */
export interface Competence {
  year: number;
  /** 1–12 (não é o índice do `Date`). */
  month: number;
}

/**
 * Por que o mês está (ou não está) disponível para fechar:
 * - `disponivel`: mês encerrado e ainda sem fechamento — o caso normal;
 * - `em-andamento`: mês corrente, ainda correndo (fechar congela dados parciais);
 * - `fechado`: já existe fechamento cobrindo o mês;
 * - `nao-iniciado`: mês futuro, sem nada para fechar.
 */
export type MonthAvailability = "disponivel" | "em-andamento" | "fechado" | "nao-iniciado";

/** Item do select de mês, com o estado que a tela colore e trava. */
export interface MonthOption extends Competence {
  /** Nome do mês em pt-BR ("Agosto"). */
  label: string;
  availability: MonthAvailability;
  /** `true` para `fechado` e `nao-iniciado` — o que não dá para escolher. */
  disabled: boolean;
}

/** Período gravado no backend, e a forma como ele volta na listagem. */
interface PeriodLike {
  periodStart: string;
  periodEnd: string;
}

/** Índice absoluto do mês: compara competências de anos diferentes como número. */
function monthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Ano e mês de uma data da API (`2026-08-01` ou `2026-08-01T00:00:00`).
 *
 * Lê os dígitos direto da string justamente para não passar por `Date`.
 */
function parseYearMonth(value: string): Competence | null {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

/** Nome do mês em pt-BR. */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** Competência por extenso, como aparece na tela ("Agosto de 2026"). */
export function formatCompetence({ year, month }: Competence): string {
  return `${monthName(month)} de ${year}`;
}

/** `yyyy-MM-dd` → `dd/MM/yyyy`. Fatia a string em vez de instanciar `Date`. */
function toBrDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Período que a competência vira na API ("01/08/2026 a 31/08/2026").
 *
 * A tela mostra isso embaixo do select: o usuário escolhe um mês, mas o que o
 * fechamento grava — e o que o detalhe vai exibir depois — continua sendo um
 * intervalo de datas.
 */
export function formatCompetenceRange(competence: Competence): string {
  const { periodStart, periodEnd } = monthRange(competence);
  return `${toBrDate(periodStart)} a ${toBrDate(periodEnd)}`;
}

/**
 * Primeiro e último dia do mês, em `yyyy-MM-dd` — o período que vai para a API.
 *
 * `new Date(year, month, 0)` é o dia 0 do mês seguinte, ou seja, o último dia
 * deste: resolve fevereiro e ano bissexto sem tabela.
 */
export function monthRange({ year, month }: Competence): PeriodLike {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    periodStart: `${year}-${pad(month)}-01`,
    periodEnd: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Último mês **encerrado** — o anterior ao de referência. É o atalho "Último
 * mês" do diálogo, e em janeiro cai em dezembro do ano anterior.
 */
export function lastEndedMonth(reference: Date = new Date()): Competence {
  const date = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Anos oferecidos no select, do atual para trás. Não há ano futuro para fechar. */
export function buildYearOptions(reference: Date = new Date(), span: number = YEAR_SPAN): number[] {
  const current = reference.getFullYear();
  return Array.from({ length: span }, (_, index) => current - index);
}

/**
 * Meses de `year` já cobertos por algum fechamento.
 *
 * Testa **sobreposição**, não igualdade de período: os fechamentos antigos foram
 * feitos com período livre, e um deles indo de 15/07 a 10/08 trava julho e
 * agosto — que é exatamente o que o backend recusaria na confirmação.
 */
export function closedMonthsOf(year: number, closings: readonly PeriodLike[]): number[] {
  const closed = new Set<number>();

  for (const closing of closings) {
    const start = parseYearMonth(closing.periodStart);
    const end = parseYearMonth(closing.periodEnd);
    if (!start || !end) continue;

    const from = monthIndex(start.year, start.month);
    const to = monthIndex(end.year, end.month);

    for (let month = 1; month <= 12; month++) {
      const index = monthIndex(year, month);
      if (index >= from && index <= to) closed.add(month);
    }
  }

  return [...closed].sort((first, second) => first - second);
}

/**
 * Os 12 meses do ano com o estado de cada um — a fonte do select.
 *
 * `fechado` tem precedência sobre `nao-iniciado`: se por algum motivo existe
 * fechamento num mês futuro, o motivo do travamento que interessa é esse.
 */
export function buildMonthOptions(
  year: number,
  closedMonths: readonly number[],
  reference: Date = new Date(),
): MonthOption[] {
  const closed = new Set(closedMonths);
  const currentIndex = monthIndex(reference.getFullYear(), reference.getMonth() + 1);

  return MONTH_NAMES.map((label, index) => {
    const month = index + 1;
    const current = monthIndex(year, month);

    let availability: MonthAvailability = "disponivel";
    if (closed.has(month)) availability = "fechado";
    else if (current > currentIndex) availability = "nao-iniciado";
    else if (current === currentIndex) availability = "em-andamento";

    return {
      year,
      month,
      label,
      availability,
      disabled: availability === "fechado" || availability === "nao-iniciado",
    };
  });
}

/**
 * Competência de um fechamento já gravado, quando ele cobre **exatamente** um
 * mês-calendário — é o que a listagem mostra no lugar do intervalo de datas.
 *
 * Devolve `null` para os fechamentos antigos de período livre (15/07 a 10/08,
 * por exemplo): ali o intervalo é a informação honesta, e inventar uma
 * competência esconderia que aquele documento não cobre o mês inteiro.
 */
export function competenceOfPeriod(period: PeriodLike): Competence | null {
  const start = parseYearMonth(period.periodStart);
  const end = parseYearMonth(period.periodEnd);
  if (!start || !end) return null;
  if (start.year !== end.year || start.month !== end.month) return null;

  const range = monthRange(start);
  const startsAtFirstDay = period.periodStart.slice(0, 10) === range.periodStart;
  const endsAtLastDay = period.periodEnd.slice(0, 10) === range.periodEnd;

  return startsAtFirstDay && endsAtLastDay ? start : null;
}

/**
 * Como o período de um fechamento aparece na tela — listagem, detalhe e o aviso
 * de exclusão falam a mesma língua: competência quando é mês cheio, intervalo
 * de datas quando não é.
 *
 * Formata pelos dígitos da string em vez de `formatShortDate`, que passa por
 * `Date`: `"2026-08-01"` sem hora seria lido como UTC e exibiria 31/07.
 */
export function describePeriod(period: PeriodLike): string {
  const competence = competenceOfPeriod(period);
  if (competence) return formatCompetence(competence);

  return `${toBrDate(period.periodStart.slice(0, 10))} — ${toBrDate(period.periodEnd.slice(0, 10))}`;
}
