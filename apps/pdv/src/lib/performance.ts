import { round2, type WeekComparisonPoint } from "@workspace/core";
import type { PerformanceDayDto, WeekdayComparisonDto } from "@workspace/api-client-react";

/**
 * Leituras do resumo de desempenho.
 *
 * Ficam fora do componente porque são regras de apresentação com decisão dentro
 * — o que fazer sem base de comparação, como rotular um dia que não é ontem —
 * e testá-las pela tela exigiria montar a modal inteira.
 */

/** Rótulos curtos dos dias, na ordem da semana comercial (segunda primeiro). */
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/** Rótulo do eixo do gráfico para o índice de dia devolvido pelo servidor. */
export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "?";
}

/** Variação entre dois valores, ou `null` quando não há base de comparação. */
export function changePercentage(current: number, previous: number): number | null {
  // Sem base, não existe variação. Devolver 100% transformaria "primeiro dia da
  // loja" em desempenho, e devolver 0% diria que ficou igual — as duas mentem.
  if (previous === 0) return null;
  return round2(((current - previous) / previous) * 100);
}

/**
 * Como a comparação com o dia anterior deve ser lida na tela.
 *
 * `sameDay` marca o caso em que o último dia com venda foi ontem: aí o rótulo
 * pode dizer "ontem", que é mais direto. Quando não foi, a tela precisa mostrar
 * a data — comparar com "sábado" sem dizer que é sábado confunde mais do que
 * ajuda numa segunda-feira.
 */
export interface PreviousDayComparison {
  /** Texto do rótulo: "ontem" ou a data formatada. */
  label: string;
  /** O dia comparado foi exatamente ontem. */
  isYesterday: boolean;
  /** Variação do faturamento de hoje sobre aquele dia. */
  change: number | null;
}

/**
 * Monta a leitura da comparação com o dia anterior.
 *
 * @param today Faturamento de hoje.
 * @param previousDay Último dia com venda. Aceita `undefined` além de `null`
 *   porque o backend OMITE o campo quando não houve dia anterior — ele nunca
 *   chega como `null` de verdade.
 * @param reference Data de hoje, para decidir se o anterior foi ontem.
 */
export function describePreviousDay(
  today: number,
  previousDay: PerformanceDayDto | null | undefined,
  reference: Date,
): PreviousDayComparison | null {
  if (!previousDay) return null;

  const previousDate = new Date(previousDay.date);
  const ontem = new Date(reference);
  ontem.setDate(ontem.getDate() - 1);

  const isYesterday = previousDate.toDateString() === ontem.toDateString();

  return {
    isYesterday,
    label: isYesterday
      ? "ontem"
      : previousDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    change: changePercentage(today, previousDay.revenue),
  };
}

/**
 * Maior acumulado entre as duas semanas, para escalar as linhas do gráfico.
 *
 * Uma escala só para as duas séries: escalas independentes fariam uma semana
 * fraca parecer igual a uma forte, que é o oposto do que o gráfico existe para
 * mostrar. O piso de 1 evita divisão por zero na semana sem venda nenhuma.
 */
export function weekComparisonScale(points: WeekComparisonPoint[]): number {
  const maior = points.reduce((max, point) => Math.max(max, point.current ?? 0, point.previous), 0);
  return maior > 0 ? maior : 1;
}

/** Soma do faturamento dos dias que já aconteceram nesta semana. */
export function weekRevenueSoFar(days: WeekdayComparisonDto[]): number {
  return round2(days.filter((day) => !day.isFuture).reduce((sum, day) => sum + day.revenue, 0));
}
