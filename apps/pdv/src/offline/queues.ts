import { tallyPendingSales, type PendingSalesTally } from "./pending-sales";
import { tallyPendingWriteOffs, type PendingWriteOffsTally } from "./pending-write-offs";
import { syncPendingSales } from "./sync";
import { syncPendingWriteOffs } from "./write-off-sync";
import type { QueueSyncOutcome } from "./types";

/**
 * As duas filas locais vistas como uma coisa só.
 *
 * Quem chama de fora — o indicador de conexão, o botão "sincronizar agora", o
 * fechamento de caixa — não tem por que saber que existem duas filas com
 * contratos de API diferentes. O que importa lá é uma pergunta: *sobrou alguma
 * coisa que o servidor ainda não conhece?*
 *
 * A separação continua existindo onde ela importa (`pending-sales.ts` e
 * `pending-write-offs.ts`); este módulo é só o ponto de composição.
 */

/** Contagem das duas filas por situação. */
export interface QueuesTally {
  sales: PendingSalesTally;
  writeOffs: PendingWriteOffsTally;
}

/** Conta as duas filas numa só passada. */
export async function tallyPendingQueues(): Promise<QueuesTally> {
  const [sales, writeOffs] = await Promise.all([tallyPendingSales(), tallyPendingWriteOffs()]);
  return { sales, writeOffs };
}

/**
 * Drena as duas filas.
 *
 * As vendas vão primeiro porque são o movimento sensível ao fechamento de caixa
 * — se a conexão só aguentar metade da rodada, é melhor que a metade que subiu
 * seja a que trava a gaveta. A baixa não entra em valor de caixa nenhum.
 *
 * @returns O resumo das duas, e quanto sobrou somando as duas filas.
 * @throws Nunca — as duas rodadas engolem falha de rede por conta própria.
 */
export async function syncPendingQueues(): Promise<QueueSyncOutcome> {
  const sales = await syncPendingSales();
  const writeOffs = await syncPendingWriteOffs();

  return { sales, writeOffs, remaining: sales.remaining + writeOffs.remaining };
}
