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
