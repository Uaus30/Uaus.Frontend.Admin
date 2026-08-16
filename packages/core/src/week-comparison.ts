import { round2 } from "./money";

/**
 * Curva acumulada da semana atual contra a anterior.
 *
 * O Admin (recharts) e o PDV (SVG) desenham o MESMO comparativo semanal, e os
 * dois precisam mostrar a mesma curva. A conta fica aqui pela mesma razão que o
 * `round2`: duplicada nos dois apps, ela divergiria no primeiro ajuste e o
 * acumulado do painel deixaria de bater com o do caixa.
 *
 * O acumulado — e não o valor bruto de cada dia — é o que permite a leitura
 * honesta, igual ao comparativo mensal: as duas linhas partem do mesmo zero e a
 * distância entre elas em qualquer dia é exatamente a diferença entre as duas
 * semanas até ali. Linhas com o valor bruto cruzariam a cada oscilação de dia
 * fraco e não responderiam "estamos na frente ou atrás?".
 */

/**
 * Um dia do comparativo semanal, como o servidor devolve.
 *
 * Espelho estrutural do `WeekdayComparisonDto` do api-client — declarado aqui
 * porque o core não depende de DTO; qualquer objeto com estes campos serve.
 */
export interface WeekComparisonDay {
  /** 0 = segunda … 6 = domingo. A semana da loja começa na segunda. */
  weekday: number;
  /** Faturamento do dia na semana atual. */
  revenue: number;
  /** Faturamento do mesmo dia na semana anterior. */
  previousRevenue: number;
  /** O dia ainda não chegou nesta semana. */
  isFuture: boolean;
}

/** Um ponto da curva acumulada, pronto para virar coordenada de gráfico. */
export interface WeekComparisonPoint {
  /** 0 = segunda … 6 = domingo. */
  weekday: number;
  /**
   * Acumulado da semana atual até este dia, ou `null` no dia que ainda não
   * chegou — o `null` corta a linha em hoje, em vez de despencar até zero.
   */
  current: number | null;
  /** Acumulado da semana anterior até o mesmo dia da semana. */
  previous: number;
}

/**
 * Converte os dias do comparativo na curva acumulada das duas semanas.
 *
 * Cada parcial passa pelo `round2` porque ela É um valor exibido — o tooltip
 * mostra o acumulado de cada dia em reais, e sem o arredondamento a soma de
 * centavos acumula erro binário (0,1 + 0,2 = 0,30000000000000004).
 *
 * @param days Dias do comparativo, em qualquer ordem — a curva ordena pelo
 *   `weekday` antes de somar, porque acumular fora de ordem inverte a curva.
 */
export function accumulateWeekComparison(days: WeekComparisonDay[]): WeekComparisonPoint[] {
  const ordered = [...days].sort((a, b) => a.weekday - b.weekday);

  let current = 0;
  let previous = 0;

  return ordered.map((day) => {
    previous = round2(previous + day.previousRevenue);
    if (!day.isFuture) current = round2(current + day.revenue);

    return {
      weekday: day.weekday,
      current: day.isFuture ? null : current,
      previous,
    };
  });
}
