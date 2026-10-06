import type { HeatCell } from "./heatmap";
import { formatBrazilianDate } from "./utils";

export const WEEKDAY_PLURAL = [
  "domingos",
  "segundas",
  "terças",
  "quartas",
  "quintas",
  "sextas",
  "sábados",
] as const;
export const WEEKDAY_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

/** "Segunda, 06/10" — o rótulo do dia na dica do hover e no painel do celular. */
export function dayTitle(cell: HeatCell): string {
  return `${WEEKDAY_LONG[cell.dayOfWeek]}, ${formatBrazilianDate(cell.date).slice(0, 5)}`;
}
