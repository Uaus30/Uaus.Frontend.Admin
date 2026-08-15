/**
 * Data e hora curtas do painel offline: `15/08 14:32`.
 *
 * Sem o ano e sem os segundos de propósito. O que o operador precisa saber de um
 * movimento na fila (ou da base local) é se ele é de hoje ou de ontem — data
 * completa só ocuparia a linha, que é estreita.
 */
export function formatQueueTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
