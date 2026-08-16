import { STORE, openLocalDatabase } from "./database";
import { getAll, put, remove } from "./idb";
import type { PendingWriteOff } from "./types";

/**
 * Fila de baixas de estoque registradas offline.
 *
 * ## Por que uma fila própria, e não a de vendas com um discriminador
 *
 * A alternativa foi considerada e descartada por três razões concretas:
 *
 * 1. **O caminho de subida é outro.** Venda sobe em lote para
 *    `POST /Pdv/sales/sync`, cujo request (`SyncPdvSalesRequest`) só aceita
 *    vendas; baixa sobe uma a uma para `POST /StockWriteOffs`, que não tem
 *    endpoint de lote. Numa fila só, todo montador de lote precisaria filtrar o
 *    discriminador antes de enviar, e um filtro esquecido mandaria uma baixa
 *    dentro de um lote de vendas.
 * 2. **Os registros quase não se sobrepõem.** Venda tem pagamento, total,
 *    desconto, consumidor e número de cupom; baixa tem motivo e nada disso.
 *    Uma união deixaria metade dos campos nulos e mentirosos justamente no tipo
 *    que `sync.ts` e o painel de pendências consomem sem verificar.
 * 3. **Os desfechos são diferentes.** A venda recebe `Created`/`Duplicated`/
 *    `Rejected` item a item dentro da resposta do lote; a baixa é aceita (201) ou
 *    recusada (erro HTTP), e a idempotência do backend faz a reentrega parecer
 *    uma gravação normal. `applySyncResults` não teria o que reaproveitar.
 *
 * O que as duas filas **compartilham de propósito** é a mecânica: chave primária
 * `clientReference` (UUID, que é também a chave de idempotência da API),
 * marcador `stockApplied`, recusa que não é retentada sozinha, e sobrevivência à
 * migração do schema local — perder a fila é perder movimento de estoque que só
 * existe aqui.
 */

/** Grava (ou regrava) uma baixa na fila. */
export async function savePendingWriteOff(writeOff: PendingWriteOff): Promise<void> {
  const db = await openLocalDatabase();
  await put(db, STORE.pendingWriteOffs, writeOff);
}

/**
 * Todas as baixas da fila, das mais antigas para as mais novas.
 *
 * A ordem importa pelo mesmo motivo da fila de vendas: as baixas disputam o
 * mesmo estoque, e a primeira do balcão precisa ser a primeira a consumir.
 * `occurredAt` está no formato lexicograficamente ordenável.
 */
export async function listPendingWriteOffs(): Promise<PendingWriteOff[]> {
  const db = await openLocalDatabase();
  const writeOffs = await getAll<PendingWriteOff>(db, STORE.pendingWriteOffs);
  return writeOffs.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

/** Baixas que ainda serão reenviadas (exclui as recusadas, que esperam decisão). */
export async function listWriteOffsToSync(): Promise<PendingWriteOff[]> {
  return (await listPendingWriteOffs()).filter((writeOff) => writeOff.status === "pending");
}

/** Contagem da fila de baixas separada por situação, para o indicador na tela. */
export interface PendingWriteOffsTally {
  /** Baixas que serão reenviadas na próxima sincronização. */
  pending: number;
  /** Baixas recusadas pelo backend, à espera de decisão do operador. */
  failed: number;
}

/** Conta a fila de baixas por situação. */
export async function tallyPendingWriteOffs(): Promise<PendingWriteOffsTally> {
  const writeOffs = await listPendingWriteOffs();
  return {
    pending: writeOffs.filter((writeOff) => writeOff.status === "pending").length,
    failed: writeOffs.filter((writeOff) => writeOff.status === "failed").length,
  };
}

/**
 * Tira a baixa da fila. Chamado quando o backend confirma que ela está gravada —
 * seja porque entrou agora, seja porque a referência já existia lá.
 */
export async function removePendingWriteOff(clientReference: string): Promise<void> {
  const db = await openLocalDatabase();
  await remove(db, STORE.pendingWriteOffs, clientReference);
}

/**
 * Marca a baixa como recusada pelo backend, guardando o motivo.
 *
 * Ela deixa de ser reenviada automaticamente: uma recusa determinística (produto
 * excluído, saldo em lote insuficiente) se repetiria a cada rodada. O operador
 * precisa decidir — corrigir a causa e reenfileirar, ou descartar.
 */
export async function markPendingWriteOffFailed(writeOff: PendingWriteOff, error: string): Promise<void> {
  await savePendingWriteOff({
    ...writeOff,
    status: "failed",
    attempts: writeOff.attempts + 1,
    lastError: error,
    // Quem marca a recusa também devolve o estoque local; o marcador registra
    // isso para que um reenvio bem-sucedido saiba que precisa debitar de novo.
    stockApplied: false,
  });
}

/**
 * Registra uma tentativa que não obteve resposta (a conexão caiu de novo no meio
 * da sincronização). A baixa continua `pending` para ser reenviada.
 */
export async function markPendingWriteOffAttempted(writeOff: PendingWriteOff): Promise<void> {
  await savePendingWriteOff({ ...writeOff, attempts: writeOff.attempts + 1 });
}

/**
 * Devolve uma baixa recusada para a fila de reenvio. É o que o operador aciona
 * depois de corrigir a causa da recusa.
 */
export async function retryPendingWriteOff(writeOff: PendingWriteOff): Promise<void> {
  await savePendingWriteOff({ ...writeOff, status: "pending", lastError: null });
}
