import { round2 } from "@workspace/core";
import type { PerformanceDayDto, PerformanceHourDto } from "@workspace/api-client-react";

/**
 * Leituras do resumo de desempenho.
 *
 * Ficam fora do componente porque são regras de apresentação com decisão dentro
 * — o que fazer sem base de comparação, como rotular um dia que não é ontem —
 * e testá-las pela tela exigiria montar a modal inteira.
 */

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

/** Primeira hora exibida quando o dia ainda não teve venda cedo — a loja abre às 8h. */
export const DEFAULT_FIRST_HOUR = 8;

/**
 * Horas que o gráfico do dia mostra.
 *
 * Recorta as 24 horas à janela em que a loja de fato operou, estendida até a
 * hora atual: vinte e quatro colunas, quase todas vazias, esconderiam a variação
 * do expediente. É o mesmo recorte do card "Faturamento de hoje" do painel.
 *
 * @param hours As 24 horas do servidor. Aceita `undefined` porque um PDV novo
 *   pode falar com uma API ainda sem o campo, e aí o gráfico some em vez de
 *   quebrar a modal.
 * @param currentHour Hora atual no relógio da loja.
 */
export function hourWindow(
  hours: PerformanceHourDto[] | undefined,
  currentHour: number,
): PerformanceHourDto[] {
  if (!hours || hours.length === 0) return [];

  const withSales = hours.filter((hour) => hour.revenue > 0).map((hour) => hour.hour);
  const first = Math.min(withSales[0] ?? DEFAULT_FIRST_HOUR, DEFAULT_FIRST_HOUR);
  const last = Math.max(withSales.at(-1) ?? currentHour, currentHour, first);

  return hours.filter((hour) => hour.hour >= first && hour.hour <= last);
}

/** Maior faturamento da janela, com piso de 1 para não dividir por zero. */
export function hourlyScale(hours: PerformanceHourDto[]): number {
  const maior = hours.reduce((max, hour) => Math.max(max, hour.revenue), 0);
  return maior > 0 ? maior : 1;
}
