import { ApiError, registerStockWriteOff } from "@workspace/api-client-react";
import {
  listWriteOffsToSync,
  markPendingWriteOffAttempted,
  markPendingWriteOffFailed,
  removePendingWriteOff,
  tallyPendingWriteOffs,
} from "./pending-write-offs";
import { consumeLocalStock, restoreLocalStock } from "./stock";
import type { PendingWriteOff, WriteOffSyncOutcome } from "./types";

/**
 * Sincronização das baixas de estoque registradas offline.
 *
 * Diferente da venda, a baixa **não tem endpoint de lote**: ela sobe uma a uma
 * para `POST /StockWriteOffs`, que é idempotente por `clientReference`. Reenviar
 * a mesma referência devolve a baixa já gravada em vez de baixar o estoque duas
 * vezes — é o que permite drenar a fila sem saber o que já subiu.
 *
 * Contrato em `Uaus.Backend.Api/docs/baixas-de-estoque.md`.
 */

/** Movimentos de estoque correspondentes aos itens da baixa. */
function toStockMovements(writeOff: PendingWriteOff) {
  return writeOff.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
}

/** Corpo que `POST /StockWriteOffs` espera para uma baixa da fila. */
export function buildWriteOffRequestBody(writeOff: PendingWriteOff) {
  return {
    reason: writeOff.reason,
    // A referência é o que torna o reenvio seguro; sem ela a fila duplicaria a
    // baixa a cada rodada que não conseguisse confirmar a resposta.
    clientReference: writeOff.clientReference,
    // Sem `occurredAt` o backend carimbaria a hora da sincronização, jogando a
    // baixa feita durante a queda para o horário em que a internet voltou.
    occurredAt: writeOff.occurredAt,
    notes: writeOff.notes,
    items: writeOff.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
  };
}

/**
 * Status HTTP que não avaliaram a baixa e por isso são transientes mesmo tendo
 * vindo numa resposta do servidor: sessão expirada (401), timeout do
 * proxy/servidor (408) e limitação de taxa (429). Os 5xx entram pela faixa.
 */
const TRANSIENT_HTTP_STATUSES = new Set([401, 408, 429]);

/**
 * Decide o que fazer com a falha de uma baixa.
 *
 * Pura, para poder ser testada sem rede: é a mesma distinção que `registerSale`
 * faz e a regra mais importante das duas filas.
 *
 * Nem todo `ApiError` é recusa: um 401 (token expirado no meio da rodada), 408,
 * 429 ou 5xx significa que o servidor **não avaliou** a baixa — tratá-los como
 * recusa marcaria a baixa como "Recusada" e devolveria ao estoque local uma
 * mercadoria que de fato saiu da prateleira. Recusa de verdade é o 4xx de regra
 * de negócio (400/404/409/422...), em que insistir só repetiria o mesmo "não".
 *
 * @returns `"rejected"` quando o servidor **avaliou e recusou** (regra de
 *   negócio), `"retry"` quando a falha é de rede ou de infraestrutura e a baixa
 *   continua valendo.
 */
export function classifyWriteOffFailure(error: unknown): "rejected" | "retry" {
  if (!(error instanceof ApiError)) return "retry";
  if (TRANSIENT_HTTP_STATUSES.has(error.status) || error.status >= 500) return "retry";
  return "rejected";
}

/** Mensagem legível de uma recusa do servidor. */
function describeRejection(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "O servidor recusou a baixa de estoque.";
}

/**
 * Envia a fila de baixas, uma a uma.
 *
 * Para na primeira falha de rede: se a conexão caiu de novo, insistir nas
 * seguintes só atrasa o retorno para o operador. O que não subiu continua na
 * fila para a próxima rodada.
 *
 * @returns O resumo da rodada, incluindo quantas baixas continuam pendentes.
 * @throws Nunca — falha de rede vira "sobrou na fila", e recusa do servidor vira
 *   baixa marcada para conferência.
 */
export async function syncPendingWriteOffs(): Promise<WriteOffSyncOutcome> {
  const queue = await listWriteOffsToSync();

  let sent = 0;
  let rejected = 0;

  for (const writeOff of queue) {
    const movements = toStockMovements(writeOff);

    try {
      await registerStockWriteOff(buildWriteOffRequestBody(writeOff));
    } catch (error) {
      if (classifyWriteOffFailure(error) === "retry") {
        // A conexão caiu no meio da drenagem. Registra a tentativa e para.
        await markPendingWriteOffAttempted(writeOff);
        break;
      }

      rejected += 1;

      // Devolve só o que ainda está debitado. Uma baixa recusada pela segunda
      // vez já teve o saldo devolvido na primeira, e devolver de novo o inflaria.
      if (writeOff.stockApplied !== false) await restoreLocalStock(movements);

      await markPendingWriteOffFailed(writeOff, describeRejection(error));
      continue;
    }

    sent += 1;

    // Uma baixa recusada antes teve o estoque local devolvido. Se agora ela
    // entrou (o operador corrigiu a causa e reenviou), o saldo precisa ser
    // debitado de novo — senão ficaria inflado até o próximo snapshot,
    // liberando venda offline de produto que já saiu da prateleira.
    if (writeOff.stockApplied === false) await consumeLocalStock(movements);

    await removePendingWriteOff(writeOff.clientReference);
  }

  const tally = await tallyPendingWriteOffs();

  return { sent, rejected, remaining: tally.pending + tally.failed };
}
