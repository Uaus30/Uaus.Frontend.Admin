import type { LowStockItem } from "../types";

/**
 * Quanto tempo o saldo dura, em texto curto.
 *
 * Vira "acaba hoje" abaixo de um dia e ganha o mês quando passa de sessenta:
 * "92 dias" é preciso e ilegível para quem só quer saber se dá para esperar a
 * próxima compra.
 *
 * Mora aqui (e não na tabela) desde 06/10/2026: a coluna "Dura" do computador e
 * o resumo do celular precisam dizer a mesma coisa.
 */
export function duracaoLegivel(days: number | null | undefined, stock: number): string {
  // Saldo zero e passado, nao previsao: "acaba hoje" para quem ja acabou manda
  // a pessoa conferir uma data que nao existe mais.
  if (stock <= 0) return "esgotado";
  if (days == null) return "—";
  if (days < 1) return "acaba hoje";
  if (days <= 60) return `${Math.round(days)} dias`;
  return `${Math.round(days / 30)} meses`;
}

/**
 * O título da coluna "Dura" mostra a conta inteira: "0,13 un./dia" sozinho não
 * diz de onde saiu, e é esta coluna que decide a ordem da lista.
 */
export function tituloDaDuracao(item: LowStockItem): string {
  const porMes = ((item.dailyDemand ?? 0) * 30).toFixed(1).replace(".", ",");
  const mediana =
    item.monthlySalesMedian != null
      ? ` — mediana de ${String(item.monthlySalesMedian).replace(".", ",")}/mês`
      : "";
  return `Demanda prevista de ${porMes} un./mês (${item.averageDailySales ?? 0} por dia)${mediana}`;
}

/** Cor da previsão: vermelho até uma semana, âmbar até três, neutro depois. */
export function duracaoTone(days: number | null | undefined, stock: number): string {
  if (stock <= 0) return "font-semibold text-red-600 dark:text-red-400";
  if (days == null) return "text-muted-foreground";
  if (days <= 7) return "font-semibold text-red-600 dark:text-red-400";
  if (days <= 21) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}
