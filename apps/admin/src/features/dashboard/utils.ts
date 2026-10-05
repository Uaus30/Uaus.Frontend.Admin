import { formatDateInput, parseDateInput } from "@workspace/ui";
import type { ComparisonPeriod, PeriodPreset, ResolvedPeriod } from "./types";

type PresetConfig = { label: string; days?: number };

/** Catálogo de todos os presets. `days` só existe nas janelas móveis; os meses são de calendário. */
const PRESET_CONFIG: Record<PeriodPreset, PresetConfig> = {
  today: { label: "Hoje", days: 1 },
  month: { label: "Este mês" },
  lastMonth: { label: "Mês passado" },
  "7d": { label: "Últimos 7 dias", days: 7 },
  "30d": { label: "Últimos 30 dias", days: 30 },
  "90d": { label: "Últimos 90 dias", days: 90 },
  "1y": { label: "Último ano", days: 365 },
};

/**
 * Presets das telas de BI (Curva ABC, Desempenho de produtos e de fornecedores),
 * na ordem em que aparecem. Ficaram como eram quando o painel ganhou os meses:
 * a mudança foi pedida para a visão geral, não para elas.
 */
export const PERIOD_PRESETS = {
  today: PRESET_CONFIG.today,
  "7d": PRESET_CONFIG["7d"],
  "30d": PRESET_CONFIG["30d"],
  "90d": PRESET_CONFIG["90d"],
  "1y": PRESET_CONFIG["1y"],
} satisfies Partial<Record<PeriodPreset, PresetConfig>>;

/**
 * Presets da visão geral. Sem "Hoje" — o card do dia corrente, logo abaixo do
 * cabeçalho, já responde isso com atualização automática — e com os meses de
 * calendário à frente: o padrão é o mês corrente, a régua com que a loja fecha
 * as contas, e a matriz diária e a curva acumulada falam do mesmo mês.
 */
export const DASHBOARD_PRESETS = {
  month: PRESET_CONFIG.month,
  lastMonth: PRESET_CONFIG.lastMonth,
  "7d": PRESET_CONFIG["7d"],
  "30d": PRESET_CONFIG["30d"],
  "90d": PRESET_CONFIG["90d"],
  "1y": PRESET_CONFIG["1y"],
} satisfies Partial<Record<PeriodPreset, PresetConfig>>;

export const DEFAULT_PERIOD: PeriodPreset = "month";

/**
 * Nomes fixados no código: o rótulo não pode depender do idioma do navegador, e
 * precisa bater com o que o backend escreve nos meses ("Outubro/2026").
 */
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

/** Rótulo "Outubro/2026" de uma data. */
export function monthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]}/${date.getFullYear()}`;
}

/** Desloca uma data em dias sem mexer no horário — sempre no fuso local. */
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Resolve um preset em datas concretas.
 *
 * A conversão passa por `formatDateInput`, e não por `toISOString()`: o backend
 * grava e compara datas no horário de Brasília, então uma data em UTC deslocaria
 * o recorte em algumas horas — o suficiente para as vendas do começo ou do fim do
 * dia caírem no período errado (ver `docs/fuso-horario.md`).
 */
export function resolvePreset(preset: PeriodPreset, today = new Date()): ResolvedPeriod {
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: formatDateInput(start), endDate: formatDateInput(today), label: monthLabel(today) };
  }

  if (preset === "lastMonth") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { startDate: formatDateInput(start), endDate: formatDateInput(end), label: monthLabel(start) };
  }

  const { days = 7, label } = PRESET_CONFIG[preset];
  return {
    startDate: formatDateInput(addDays(today, -(days - 1))),
    endDate: formatDateInput(today),
    label,
  };
}

/** Rótulo curto `dd/MM` de uma data local. */
function shortDate(date: Date): string {
  return formatAxisDate(formatDateInput(date));
}

/**
 * Base de comparação dos cards para o período em vigor.
 *
 * - **Mês em curso:** os mesmos dias da semana, quatro semanas antes (cinco, se o
 *   mês já passou de 28 dias, para as duas janelas não se sobreporem). O "mesmo
 *   dia do mês anterior" parece natural, mas mistura dias da semana: medido em
 *   04/10/2026, 1 a 3/10 (qui a sáb) contra 1 a 3/09 (ter a qui) dava +72%;
 *   alinhado, +21%. Nesta loja o sábado fatura o dobro da segunda.
 * - **Mês fechado:** o mês anterior inteiro.
 * - **Janelas móveis e intervalo livre:** o período imediatamente anterior, de
 *   mesma duração — que é também o que o backend usa quando nada é pedido.
 */
export function resolveComparison(preset: PeriodPreset | null, period: ResolvedPeriod): ComparisonPeriod {
  const start = parseDateInput(period.startDate) ?? new Date();
  const end = parseDateInput(period.endDate) ?? start;
  const lengthInDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  if (preset === "month") {
    const weeks = Math.max(4, Math.ceil(lengthInDays / 7));
    const compareStart = addDays(start, -weeks * 7);
    const compareEnd = addDays(end, -weeks * 7);
    return {
      startDate: formatDateInput(compareStart),
      endDate: formatDateInput(compareEnd),
      label: `vs ${weeks} semanas antes`,
      description:
        `Comparado com ${shortDate(compareStart)} a ${shortDate(compareEnd)}: os mesmos dias da semana, ` +
        `${weeks} semanas antes. Comparar com o mesmo dia do mês misturaria dias da semana diferentes, ` +
        "e o sábado vende o dobro da segunda.",
    };
  }

  if (preset === "lastMonth") {
    const compareStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const compareEnd = new Date(start.getFullYear(), start.getMonth(), 0);
    const name = monthLabel(compareStart);
    return {
      startDate: formatDateInput(compareStart),
      endDate: formatDateInput(compareEnd),
      label: `vs ${name.split("/")[0].toLowerCase()}`,
      description: `Comparado com ${name} inteiro (${shortDate(compareStart)} a ${shortDate(compareEnd)}).`,
    };
  }

  const compareStart = addDays(start, -lengthInDays);
  const compareEnd = addDays(start, -1);
  return {
    startDate: formatDateInput(compareStart),
    endDate: formatDateInput(compareEnd),
    label: "vs período anterior",
    description:
      `Comparado com ${shortDate(compareStart)} a ${shortDate(compareEnd)}: ` +
      `os ${lengthInDays} dias imediatamente anteriores.`,
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
