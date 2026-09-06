import { apiPost } from "@workspace/api-client-react";
import {
  listSalesToSync,
  markPendingSaleAttempted,
  markPendingSaleFailed,
  removePendingSale,
  tallyPendingSales,
} from "./pending-sales";
import { consumeLocalStock, restoreLocalStock } from "./stock";
import type { PendingSale, SaleSyncResult, SyncOutcome, SyncSalesResponse } from "./types";

/**
 * Sincronização das vendas offline.
 *
 * A fila é enviada em lotes; cada venda tem o seu próprio desfecho e o backend
 * nunca reprova o lote inteiro. Ver `Uaus.Backend.Api/docs/pdv-offline.md`.
 *
 * **Cupom estourado não é recusa.** Este endpoint grava em modo tolerante: uso
 * acima do limite entra carimbado como `over_limit`, e definição que mudou depois
 * da venda entra como `definition_drift`, prevalecendo o valor que o cliente
 * levou impresso. Nenhum dos dois vira `Rejected` — o dinheiro já mudou de mãos
 * no balcão, e limite de cupom é orçamento de marketing, não estoque.
 */

/** Endpoint do lote de sincronização. */
const SYNC_PATH = "/Pdv/sales/sync";

/**
 * Vendas por lote. Precisa ser menor ou igual ao
 * `SyncPdvSalesRequest.MaxSalesPerBatch` do backend (50) — se lá mudar, mude aqui.
 */
export const SYNC_BATCH_SIZE = 25;

/**
 * O bloco do cupom no corpo da requisição, ou `null` quando a venda não teve
 * cupom.
 *
 * `null` (e não `undefined`) porque `RegisterPdvSaleCouponRequest? Coupon` do
 * backend aceita a ausência explicitamente, e porque as vendas que já estavam na
 * fila antes desta feature sobem sem o campo — `pendingSales` sobrevive à
 * migração do schema local, e o `?? null` é o que impede que elas quebrem.
 *
 * A campanha não vai junto de propósito: o PDV nunca soube dela, e é o servidor
 * quem fotografa o vínculo na gravação.
 */
function toCouponBody(sale: PendingSale) {
  const coupon = sale.coupon ?? null;
  if (!coupon) return null;

  return {
    couponId: coupon.couponId,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    baseAmount: coupon.baseAmount,
    // JÁ INCLUÍDO em `discount` — o backend confere `discount >= discountAmount`
    // e recalcula o total contra os itens. Somar os dois recusaria a venda.
    discountAmount: coupon.discountAmount,
    answers: (coupon.answers ?? []).map((answer) => ({
      questionId: answer.questionId,
      optionId: answer.optionId,
    })),
  };
}

/** Converte a venda da fila no corpo que a API espera. */
function toRequestBody(sale: PendingSale) {
  return {
    clientReference: sale.clientReference,
    occurredAt: sale.occurredAt,
    cashRegisterSessionId: sale.cashRegisterSessionId,
    customerId: sale.customerId,
    customerDocument: sale.customerDocument,
    total: sale.total,
    discount: sale.discount,
    coupon: toCouponBody(sale),
    notes: sale.notes,
    items: sale.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      // `?? 0` cobre as vendas que já estavam na fila antes de o campo existir:
      // `pendingSales` sobrevive à migração, então elas sobem sem `discount`.
      // Não houve troca de versão da base — nada mudou no esquema, e subir a
      // versão apagaria as stores de catálogo de todo caixa na próxima abertura.
      discount: item.discount ?? 0,
      // O acréscimo entrou pelo mesmo caminho e pela mesma razão: campo novo num
      // objeto já gravado não é mudança de esquema do IndexedDB.
      surcharge: item.surcharge ?? 0,
      surchargeReason: (item.surcharge ?? 0) > 0 ? (item.surchargeReason ?? null) : null,
    })),
    payments: sale.payments.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      paymentMethodInstallmentId: payment.paymentMethodInstallmentId,
      amount: payment.amount,
      installments: payment.installments,
      transactionFee: payment.transactionFee,
    })),
  };
}

/** Corpo de uma venda pronto para `POST /Pdv/sales` ou para o lote de sincronização. */
export type PdvSaleRequestBody = ReturnType<typeof toRequestBody>;

/** Monta o corpo de requisição de uma venda da fila. */
export const buildSaleRequestBody = toRequestBody;

/**
 * Normaliza o `status` do resultado.
 *
 * A API serializa enums pelo nome do membro em C#, mas uma configuração de
 * serialização diferente devolveria o código numérico. Aceitar os dois evita que
 * uma venda gravada seja tratada como recusada por causa do formato.
 */
export function readSyncStatus(result: SaleSyncResult): "created" | "duplicated" | "rejected" {
  const status = result.status;

  if (status === "Created" || status === 1) return "created";
  if (status === "Duplicated" || status === 2) return "duplicated";
  return "rejected";
}

/** Divide a fila em lotes do tamanho aceito pela API. */
export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * Aplica na fila local o desfecho de um lote.
 *
 * - `Created` e `Duplicated`: a venda está gravada no servidor, sai da fila.
 * - `Rejected`: fica na fila marcada com o motivo, e o estoque local que ela
 *   havia debitado é devolvido — aquela venda não existe, então o saldo local
 *   estava mentindo para baixo.
 *
 * Uma venda que não aparece na resposta continua `pending`, apenas com uma
 * tentativa a mais registrada.
 *
 * @param batch Vendas enviadas no lote.
 * @param results Desfechos devolvidos pela API.
 */
export async function applySyncResults(
  batch: PendingSale[],
  results: SaleSyncResult[],
): Promise<{ created: number; duplicated: number; rejected: number }> {
  const byReference = new Map(results.map((result) => [result.clientReference, result]));
  let created = 0;
  let duplicated = 0;
  let rejected = 0;

  for (const sale of batch) {
    const result = byReference.get(sale.clientReference);

    if (!result) {
      await markPendingSaleAttempted(sale);
      continue;
    }

    const status = readSyncStatus(result);
    const movements = sale.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    if (status === "created" || status === "duplicated") {
      if (status === "created") created += 1;
      else duplicated += 1;

      // Uma venda recusada antes teve o estoque local devolvido. Se agora ela
      // entrou (o operador corrigiu a causa e reenviou), o saldo precisa ser
      // debitado de novo — senão ficaria inflado até o próximo snapshot,
      // liberando venda offline de produto que já saiu da prateleira.
      if (sale.stockApplied === false) await consumeLocalStock(movements);

      await removePendingSale(sale.clientReference);
      continue;
    }

    rejected += 1;

    // Devolve só o que ainda está debitado. Uma venda recusada pela segunda vez
    // já teve o saldo devolvido na primeira, e devolver de novo o inflaria.
    // A comparação com `false` é proposital: vendas gravadas antes deste campo
    // existir têm o estoque debitado e precisam da devolução.
    if (sale.stockApplied !== false) await restoreLocalStock(movements);

    await markPendingSaleFailed(sale, result.message ?? "O servidor recusou a venda.");
  }

  return { created, duplicated, rejected };
}

/** Envia um lote para a API. */
export function postSyncBatch(batch: PendingSale[]): Promise<SyncSalesResponse> {
  return apiPost<SyncSalesResponse>(SYNC_PATH, { sales: batch.map(toRequestBody) }).then(
    (response) =>
      response.data ?? {
        syncedAt: new Date().toISOString(),
        createdCount: 0,
        duplicatedCount: 0,
        rejectedCount: 0,
        results: [],
      },
  );
}

/**
 * Sincroniza a fila inteira, em lotes.
 *
 * Para no primeiro lote que falhar em rede: se a conexão caiu de novo, insistir
 * nos lotes seguintes só atrasa o retorno para o operador. As vendas que não
 * foram enviadas continuam na fila para a próxima rodada.
 *
 * @returns O resumo da rodada, incluindo quantas vendas continuam pendentes.
 * @throws Nunca — falha de rede vira "sobrou na fila". Erros de negócio já vêm
 *   como recusa no corpo da resposta.
 */
export async function syncPendingSales(): Promise<SyncOutcome> {
  const queue = await listSalesToSync();

  let created = 0;
  let duplicated = 0;
  let rejected = 0;

  for (const batch of chunk(queue, SYNC_BATCH_SIZE)) {
    let response: SyncSalesResponse;

    try {
      response = await postSyncBatch(batch);
    } catch {
      // A conexão caiu no meio da sincronização. Registra a tentativa e para: o
      // que sobrou na fila entra na próxima rodada.
      for (const sale of batch) await markPendingSaleAttempted(sale);
      break;
    }

    const applied = await applySyncResults(batch, response.results ?? []);
    created += applied.created;
    duplicated += applied.duplicated;
    rejected += applied.rejected;
  }

  const tally = await tallyPendingSales();

  return { created, duplicated, rejected, remaining: tally.pending + tally.failed };
}
