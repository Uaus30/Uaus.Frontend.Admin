import { toDateKey } from "@workspace/core";

/** Data (`yyyy-MM-dd`) e hora (`HH:mm`) da venda, como o formulário as edita. */
export type SaleWhen = { date: string; time: string };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Agora, no relógio do aparelho — o padrão de uma venda nova. */
export function nowSaleWhen(now = new Date()): SaleWhen {
  return { date: toDateKey(now), time: `${pad(now.getHours())}:${pad(now.getMinutes())}` };
}

/**
 * Separa a data da API (`2026-10-05T14:32:10`, horário de Brasília sem fuso) em
 * data e hora para o formulário de correção.
 *
 * Corta a STRING, e não passa por `new Date()`: lida no fuso do aparelho, a hora
 * da API sai deslocada em todo celular fora de Brasília (armadilha 8 do
 * `CLAUDE.md` do front) — e a venda seria regravada com a hora errada só por ter
 * sido aberta para corrigir a observação.
 */
export function splitApiDateTime(value: string): SaleWhen {
  const [date = "", rest = ""] = value.split("T");
  return { date, time: rest.slice(0, 5) || "00:00" };
}

/**
 * A data e hora prontas para a API: horário da loja, sem fuso
 * (`2026-10-05T14:32:00`) — o formato de `toLocalTimestamp`. Nunca
 * `toISOString()`, que converte para UTC e muda a hora (armadilha 5).
 */
export function joinSaleWhen({ date, time }: SaleWhen): string {
  return `${date}T${time || "00:00"}:00`;
}

/** Nova venda de outro dia: o que a data muda ao REGISTRAR (caixa e estoque). */
export const BACKDATED_SALE_NOTICE =
  "Venda de outro dia: ela fica fora do caixa de hoje. O estoque baixa agora, dos lotes de hoje — se o produto já foi contado depois dessa data, confira o saldo depois.";

/**
 * Data mudada na CORREÇÃO: só os relatórios andam. O aviso da venda nova aqui
 * seria falso — a correção não mexe em estoque nem em caixa —, e aparecia em
 * quase toda correção, porque quase toda é de venda passada.
 */
export const REDATED_SALE_NOTICE =
  "A venda passa para a data nova nos relatórios e no Dashboard; estoque e caixa não mudam. Venda do caixa do PDV, com cupom ou de período já fechado não muda de data.";

/** A venda é de hoje? Fora de hoje ela não entra no caixa aberto. */
export function isSaleToday(when: SaleWhen, now = new Date()): boolean {
  return when.date === toDateKey(now);
}

/**
 * A data e hora estão no futuro? O servidor recusa (com folga de cinco minutos);
 * a tela avisa antes. Comparação de string funciona porque os dois lados estão no
 * mesmo formato e no mesmo relógio.
 */
export function isSaleInFuture(when: SaleWhen, now = new Date()): boolean {
  const today = nowSaleWhen(now);
  return when.date > today.date || (when.date === today.date && when.time > today.time);
}
