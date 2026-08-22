/**
 * Datas.
 *
 * Regra do módulo: data de calendário (competência, dia da venda, filtro de
 * período) NUNCA passa por `toISOString()`. Esse método converte para UTC, e
 * no Brasil isso joga o dia para trás em qualquer horário antes das 21h —
 * "hoje" vira "ontem" no filtro.
 */

/**
 * Data e hora no formato pt-BR — "15/08/2026 14:30".
 *
 * @param dateString Data ISO vinda da API.
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Só a data, no formato pt-BR — "15/08/2026".
 *
 * @param dateString Data ISO vinda da API.
 */
export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Chave de data "yyyy-MM-dd" no fuso LOCAL, para mandar à API como filtro.
 *
 * Use esta função no lugar de `date.toISOString().slice(0, 10)`: o `toISOString`
 * converte para UTC, então às 20h de 15/08 em São Paulo ele devolve "2026-08-15"
 * mas às 22h devolve "2026-08-16" — o relatório do dia passa a incluir o dia
 * seguinte e a excluir horas do próprio dia.
 *
 * @param date Data a converter.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Data e hora completas no formato pt-BR no fuso horário de Brasília (UTC-3) — "15/08/2026 às 14:30:00".
 *
 * Utiliza explicitamente o fuso `America/Sao_Paulo` para garantir exibição correta
 * em qualquer navegador ou ambiente, independente do fuso local da máquina.
 *
 * @param dateInput Instância de Date, string ISO ou timestamp numérico.
 */
export function formatBrasiliaDateTime(dateInput: Date | string | number): string {
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const { day, month, year, hour, minute, second } = partMap;
  if (!day || !month || !year || !hour || !minute || !second) return "";

  return `${day}/${month}/${year} às ${hour}:${minute}:${second}`;
}

/**
 * Formata o rótulo de versão do sistema (ex: "Versão 1.0.144").
 *
 * @param version String da versão (ex: "1.0.144" ou "v1.0.144").
 */
export function formatVersion(version?: string): string {
  if (!version) return "Versão 0.0.0";
  const clean = version.startsWith("v") ? version.slice(1) : version;
  return `Versão ${clean}`;
}

/**
 * Formata o texto descritivo de atualização do sistema com fuso de Brasília.
 * Ex: "Atualizado em 22/08/2026 às 12:45:12".
 *
 * @param timestamp Data/hora da compilação ou deploy.
 */
export function formatUpdatedAt(timestamp?: string | Date | number): string {
  if (!timestamp) return "";
  const formatted = formatBrasiliaDateTime(timestamp);
  if (!formatted) return "";
  return `Atualizado em ${formatted}`;
}

