import { STORE, openLocalDatabase } from "./database";
import { count, getAll, put, remove } from "./idb";
import type { PendingSale } from "./types";

/**
 * Fila de vendas registradas offline.
 *
 * É a única store da base local que contém dado que o servidor não tem — perder
 * a fila é perder venda. Por isso ela sobrevive à migração do schema local e não
 * é tocada quando o snapshot substitui o cadastro.
 *
 * A chave é o `clientReference` (UUID gerado no caixa), que é também a chave de
 * idempotência da API: a mesma venda nunca entra duas vezes no banco, mesmo que
 * a resposta da sincronização se perca.
 */

/** Grava (ou regrava) uma venda na fila. */
export async function savePendingSale(sale: PendingSale): Promise<void> {
  const db = await openLocalDatabase();
  await put(db, STORE.pendingSales, sale);
}

/**
 * Todas as vendas da fila, das mais antigas para as mais novas.
 *
 * A ordem importa na sincronização: as vendas disputam o mesmo estoque, e a
 * primeira do balcão precisa ser a primeira a consumir.
 */
export async function listPendingSales(): Promise<PendingSale[]> {
  const db = await openLocalDatabase();
  const sales = await getAll<PendingSale>(db, STORE.pendingSales);
  return sales.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.offlineNumber - b.offlineNumber);
}

/** Vendas que ainda serão reenviadas (exclui as recusadas, que esperam decisão). */
export async function listSalesToSync(): Promise<PendingSale[]> {
  return (await listPendingSales()).filter((sale) => sale.status === "pending");
}

/** Quantas vendas estão na fila, sem carregá-las. */
export async function countPendingSales(): Promise<number> {
  const db = await openLocalDatabase();
  return count(db, STORE.pendingSales);
}

/** Contagem da fila separada por situação, para o indicador na tela. */
export interface PendingSalesTally {
  /** Vendas que serão reenviadas na próxima sincronização. */
  pending: number;
  /** Vendas recusadas pelo backend, à espera de decisão do operador. */
  failed: number;
}

/** Conta a fila por situação. */
export async function tallyPendingSales(): Promise<PendingSalesTally> {
  const sales = await listPendingSales();
  return {
    pending: sales.filter((sale) => sale.status === "pending").length,
    failed: sales.filter((sale) => sale.status === "failed").length,
  };
}

/**
 * Tira a venda da fila. Chamado quando o backend confirma que ela está gravada —
 * seja porque entrou agora, seja porque já estava lá.
 */
export async function removePendingSale(clientReference: string): Promise<void> {
  const db = await openLocalDatabase();
  await remove(db, STORE.pendingSales, clientReference);
}

/**
 * Marca a venda como recusada pelo backend, guardando o motivo.
 *
 * Ela deixa de ser reenviada automaticamente: repetir uma recusa determinística
 * (estoque insuficiente, produto excluído) só geraria ruído a cada tentativa. O
 * operador precisa decidir — refazer a venda com o estoque certo, ou descartar.
 */
export async function markPendingSaleFailed(sale: PendingSale, error: string): Promise<void> {
  await savePendingSale({
    ...sale,
    status: "failed",
    attempts: sale.attempts + 1,
    lastError: error,
    // Quem marca a recusa também devolve o estoque local; o marcador registra
    // isso para que um reenvio bem-sucedido saiba que precisa debitar de novo.
    stockApplied: false,
  });
}

/**
 * Registra uma tentativa que não obteve resposta (a conexão caiu de novo no meio
 * da sincronização). A venda continua `pending` para ser reenviada.
 */
export async function markPendingSaleAttempted(sale: PendingSale): Promise<void> {
  await savePendingSale({ ...sale, attempts: sale.attempts + 1 });
}

/**
 * Devolve uma venda recusada para a fila de reenvio. É o que o operador acionaria
 * depois de corrigir a causa da recusa (uma entrada de estoque, por exemplo).
 */
export async function retryPendingSale(sale: PendingSale): Promise<void> {
  await savePendingSale({ ...sale, status: "pending", lastError: null });
}
