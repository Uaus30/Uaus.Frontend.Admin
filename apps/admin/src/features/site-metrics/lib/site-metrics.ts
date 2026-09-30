import { formatDateInput } from "@workspace/ui";

/** Os períodos que a tela oferece, em dias contando hoje. */
export const SITE_PERIODS = [
  { days: 7, label: "Últimos 7 dias" },
  { days: 30, label: "Últimos 30 dias" },
  { days: 90, label: "Últimos 90 dias" },
  { days: 365, label: "Último ano" },
] as const;

export type SitePeriodDays = (typeof SITE_PERIODS)[number]["days"];

export const DEFAULT_SITE_PERIOD: SitePeriodDays = 30;

/**
 * Resolve o preset em datas `yyyy-MM-dd`. Passa por `formatDateInput`, e não
 * por `toISOString()`: o backend compara no horário de Brasília, e a data em
 * UTC deslocaria o recorte (armadilha 2 do CLAUDE.md).
 */
export function resolveSitePeriod(days: SitePeriodDays, today = new Date()) {
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  return { startDate: formatDateInput(start), endDate: formatDateInput(today) };
}

/**
 * Tempo em ms como a pessoa lê: "45 s", "2 min 10 s", "1 h 05 min". Zero vira
 * "—": sessão sem `page_leave` ainda não tem tempo, e "0 s" leria como "ficou
 * zero segundos", que é outra afirmação.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

/** Inteiro no padrão brasileiro (ponto de milhar). */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

/** Percentual de `part` sobre `total`, sem decimal; total zero dá "—". */
export function formatShare(part: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

/** `yyyy-MM-dd` → "30/09". */
export function formatDayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

/** `yyyy-MM-dd` → "30/09/2026". */
export function formatFullDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Nome legível da rota normalizada que o coletor grava. As rotas do site são
 * poucas e fixas; o que não estiver aqui aparece como veio.
 */
export function describePath(path: string): string {
  switch (path) {
    case "/":
      return "Início";
    case "/produtos":
      return "Produtos";
    case "/produtos/:id":
      return "Detalhe do produto";
    case "/contato":
      return "Contato";
    default:
      return path;
  }
}
