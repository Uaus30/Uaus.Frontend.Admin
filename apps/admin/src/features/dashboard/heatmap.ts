import { formatDateInput, parseDateInput } from "@workspace/ui";
import type { DailyReference, MonthDayPoint, MonthSummary } from "./types";
import { growth } from "./utils";

/**
 * Regras da matriz de faturamento diário.
 *
 * Ficam fora do componente porque são elas que decidem o que a tela afirma — a cor
 * de um dia, a seta de "fora do normal", a variação da semana — e precisam ser
 * verificadas sem renderizar nada.
 */

/**
 * Pontos da escala de cor, em múltiplos do dia "normal" da loja: o faturamento
 * igual a `HEAT_STOPS[i]` vezes a régua recebe exatamente o tom `--heat-i`, e
 * entre dois pontos a cor é interpolada. De 2x a régua para cima, o tom máximo.
 *
 * A escala é CONTÍNUA de propósito. Com cinco faixas fixas, R$ 15 e R$ 42 (ou
 * R$ 445 e R$ 859) saíam do mesmo tom, e o dono pediu ver a diferença. Os pontos
 * ficam mais juntos em volta de 1x, onde está a maioria dos dias.
 *
 * A régua é a média dos dias com venda dos três meses fechados, e não o maior dia
 * do mês: um único dia fora da curva (medido em julho/2026: R$ 1.206 com mediana de
 * R$ 308) deixaria o resto do mês todo apagado. Também não são quantis, que
 * pintariam um mês fraco tão colorido quanto um mês forte.
 */
export const HEAT_STOPS = [0, 0.5, 0.9, 1.1, 1.5, 2] as const;

/** Posição do dia "normal" (1x a régua) na escala de 0 a 5. */
export const NORMAL_DAY_POSITION = 2.5;

/** Desvio contra a média do dia da semana que vira seta na célula. */
export const WEEKDAY_SIGNAL_RATIO = 0.3;

/** Amostra mínima do dia da semana para a média valer como comparação. */
const MIN_WEEKDAY_SAMPLE = 3;

/** Colunas de segunda a sábado; o domingo só entra se o mês teve venda num domingo. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Posição do dia na escala de cor, de 0 (quase nada) a 5 (2x um dia normal ou
 * mais). `null` é dia sem venda, que fica fora da escala. Sem régua, o meio.
 */
export function heatPosition(revenue: number, reference: number): number | null {
  if (revenue <= 0) return null;
  if (reference <= 0) return NORMAL_DAY_POSITION;

  const ratio = revenue / reference;
  const last = HEAT_STOPS.length - 1;
  if (ratio >= HEAT_STOPS[last]) return last;

  let index = 0;
  while (ratio >= HEAT_STOPS[index + 1]) index++;
  return index + (ratio - HEAT_STOPS[index]) / (HEAT_STOPS[index + 1] - HEAT_STOPS[index]);
}

/**
 * Régua efetiva da matriz.
 *
 * Sem histórico (loja nova, banco recém-migrado) a média dos três meses vem zerada;
 * aí a régua cai para a média dos dias com venda que a própria tela mostra, para a
 * matriz não ficar inteira num tom só.
 */
export function resolveReferenceRevenue(
  reference: DailyReference | undefined,
  months: MonthSummary[],
): number {
  if (reference && reference.averageRevenue > 0) return reference.averageRevenue;

  const days = months.flatMap((month) => month.days.filter((day) => day.hasHappened && day.salesCount > 0));
  if (days.length === 0) return 0;
  return days.reduce((sum, day) => sum + day.revenue, 0) / days.length;
}

/**
 * Seta da célula: o dia ficou bem acima ou bem abaixo do que aquele dia da
 * semana costuma faturar.
 *
 * A cor diz o valor e por isso deixa o sábado sempre escuro — o que a loja já
 * sabe. A seta é o que a cor não mostra: um sábado fraco ou uma terça excelente.
 * Dia sem venda não ganha seta, porque quase sempre é loja fechada (feriado), não
 * queda.
 */
export function weekdaySignal(
  revenue: number,
  weekdayAverage: number,
  sampleSize: number,
): "above" | "below" | null {
  if (revenue <= 0 || weekdayAverage <= 0 || sampleSize < MIN_WEEKDAY_SAMPLE) return null;
  if (revenue >= weekdayAverage * (1 + WEEKDAY_SIGNAL_RATIO)) return "above";
  if (revenue <= weekdayAverage * (1 - WEEKDAY_SIGNAL_RATIO)) return "below";
  return null;
}

export type HeatCell = {
  /** `yyyy-MM-dd`. */
  date: string;
  day: number;
  dayOfWeek: number;
  revenue: number;
  profit: number;
  salesCount: number;
  hasHappened: boolean;
  isToday: boolean;
  /** Posição na escala de cor (ver `heatPosition`); `null` sem venda ou dia futuro. */
  position: number | null;
  signal: "above" | "below" | null;
  weekdayAverage: number;
};

export type HeatWeek = {
  /** Uma posição por coluna; `null` é dia de outro mês. */
  cells: Array<HeatCell | null>;
  /** Soma dos dias já vividos da semana dentro do mês, hoje incluído. */
  total: number;
  /**
   * Soma dos dias da semana que entram na comparação: os já fechados, sem hoje.
   * Comparar o parcial de hoje com o dia cheio da semana anterior mostraria, numa
   * segunda às dez da manhã, uma queda de quase 90% que é só o relógio.
   */
  comparableTotal: number;
  /** Os mesmos dias de `comparableTotal`, sete dias antes. `null` quando falta dado. */
  previousTotal: number | null;
  /** `null` sem base ou quando a semana ainda não tem dia fechado. */
  growth: number | null;
};

export type HeatGrid = {
  /** Dias da semana de cada coluna (0 é domingo), na ordem exibida. */
  columns: number[];
  weeks: HeatWeek[];
};

/**
 * Monta o calendário do mês em semanas de segunda a sábado.
 *
 * @param lookup Faturamento por data (`yyyy-MM-dd`) de todos os dias conhecidos —
 * inclusive os do mês anterior, que fornecem a semana de comparação da primeira
 * linha.
 */
export function buildHeatGrid(
  month: MonthSummary,
  lookup: Map<string, MonthDayPoint>,
  reference: DailyReference | undefined,
  referenceRevenue: number,
  today: string,
): HeatGrid {
  const first = parseDateInput(month.startDate.split("T")[0]) ?? new Date();
  const dateOf = (day: number) => new Date(first.getFullYear(), first.getMonth(), day);

  const hasSundaySales = month.days.some((point) => dateOf(point.day).getDay() === 0 && point.salesCount > 0);
  const columns: number[] = WEEK_ORDER.filter((dayOfWeek) => dayOfWeek !== 0 || hasSundaySales);

  const weekdays = new Map((reference?.weekdays ?? []).map((item) => [item.dayOfWeek, item]));

  const weeks: HeatWeek[] = [];
  let current: HeatWeek | null = null;

  for (const point of month.days) {
    const date = dateOf(point.day);
    const dayOfWeek = date.getDay();
    // A semana começa na segunda: é nela (ou no dia 1) que abre uma linha nova.
    if (current === null || dayOfWeek === 1) {
      current = {
        cells: columns.map(() => null),
        total: 0,
        comparableTotal: 0,
        previousTotal: 0,
        growth: null,
      };
      weeks.push(current);
    }

    const column = columns.indexOf(dayOfWeek);
    const key = formatDateInput(date);
    const isToday = key === today;
    const weekday = weekdays.get(dayOfWeek);
    const weekdayAverage = weekday?.averageRevenue ?? 0;

    if (point.hasHappened) {
      current.total += point.revenue;
    }

    if (point.hasHappened && !isToday) {
      current.comparableTotal += point.revenue;
      const lastWeek = lookup.get(
        formatDateInput(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7)),
      );
      current.previousTotal =
        lastWeek && current.previousTotal !== null ? current.previousTotal + lastWeek.revenue : null;
    }

    // Domingo sem venda num mês sem coluna de domingo simplesmente não aparece.
    if (column < 0) continue;

    current.cells[column] = {
      date: key,
      day: point.day,
      dayOfWeek,
      revenue: point.revenue,
      profit: point.profit,
      salesCount: point.salesCount,
      hasHappened: point.hasHappened,
      isToday,
      position: point.hasHappened ? heatPosition(point.revenue, referenceRevenue) : null,
      // Hoje ainda está acontecendo: comparar o parcial com a média do dia
      // inteiro mostraria uma queda que é só o relógio.
      signal:
        point.hasHappened && !isToday
          ? weekdaySignal(point.revenue, weekdayAverage, weekday?.daysWithSales ?? 0)
          : null,
      weekdayAverage,
    };
  }

  for (const week of weeks) {
    const closed = week.cells.some((cell) => cell?.hasHappened && !cell.isToday);
    if (!closed) week.previousTotal = null;
    week.growth = week.previousTotal === null ? null : growth(week.comparableTotal, week.previousTotal);
  }

  // Um mês que começa num domingo sem coluna abriria uma linha sem nenhuma casa.
  return { columns, weeks: weeks.filter((week) => week.cells.some((cell) => cell !== null)) };
}

/** Índice por data de todos os dias dos meses informados, para a comparação semanal. */
export function indexDays(months: MonthSummary[]): Map<string, MonthDayPoint> {
  const index = new Map<string, MonthDayPoint>();
  for (const month of months) {
    const first = parseDateInput(month.startDate.split("T")[0]);
    if (!first) continue;
    for (const point of month.days) {
      if (!point.hasHappened) continue;
      index.set(formatDateInput(new Date(first.getFullYear(), first.getMonth(), point.day)), point);
    }
  }
  return index;
}
