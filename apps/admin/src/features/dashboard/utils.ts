import { formatDateInput } from "@workspace/ui";
import type { PeriodPreset, ResolvedPeriod } from "./types";

/**
 * Quantos dias cada preset cobre, contando o dia de hoje.
 *
 * O padrão do painel é `7d` — a pergunta mais frequente é "como foi a semana",
 * e uma janela curta também deixa a primeira carga mais leve.
 */
export const PERIOD_PRESETS: Record<PeriodPreset, { days: number; label: string }> = {
  today: { days: 1, label: "Hoje" },
  "7d": { days: 7, label: "Últimos 7 dias" },
  "30d": { days: 30, label: "Últimos 30 dias" },
  "90d": { days: 90, label: "Últimos 90 dias" },
  "1y": { days: 365, label: "Último ano" },
};

export const DEFAULT_PERIOD: PeriodPreset = "7d";

/**
 * Resolve um preset em datas concretas.
 *
 * A conversão passa por `formatDateInput`, e não por `toISOString()`: o backend
 * grava e compara datas no horário de Brasília, então uma data em UTC deslocaria
 * o recorte em algumas horas — o suficiente para as vendas do começo ou do fim do
 * dia caírem no período errado (ver `docs/fuso-horario.md`).
 */
export function resolvePreset(preset: PeriodPreset, today = new Date()): ResolvedPeriod {
  const { days, label } = PERIOD_PRESETS[preset];
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  return {
    startDate: formatDateInput(start),
    endDate: formatDateInput(today),
    label,
  };
}

/** Monta o período a partir de um intervalo escolhido no calendário. */
export function resolveCustom(startDate: string, endDate: string): ResolvedPeriod {
  return {
    startDate,
    endDate,
    label: `${formatBrazilianDate(startDate)} até ${formatBrazilianDate(endDate)}`,
  };
}

/** Converte `yyyy-MM-dd` para `dd/MM/yyyy` sem passar por `Date`, evitando fuso. */
export function formatBrazilianDate(value: string): string {
  const [year, month, day] = value.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

/** Rótulo curto `dd/MM` usado nos eixos dos gráficos de série diária. */
export function formatAxisDate(value: string): string {
  const [, month, day] = value.split("T")[0].split("-");
  return `${day}/${month}`;
}

/** Rótulo `HH:mm` de um instante devolvido pela API. */
export function formatClock(value: string): string {
  const time = value.split("T")[1] ?? "";
  return time.slice(0, 5);
}

/**
 * Variação percentual entre dois valores.
 *
 * Devolve `null` quando não há base de comparação: uma alta "de 0 para 100" não
 * é 100% nem infinita, e mostrar qualquer número ali seria inventar informação.
 * Quem consome decide como exibir a ausência.
 */
export function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Abreviação compacta para eixos: 1.2k, 45k, 1.3M. */
export function compactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

/** Percentual com uma casa e sinal explícito, para os comparativos. */
export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}
