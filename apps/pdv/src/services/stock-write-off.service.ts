import { ApiError, registerStockWriteOff, type StockWriteOffDto } from "@workspace/api-client-react";
import {
  checkLocalStock,
  consumeLocalStock,
  savePendingWriteOff,
  type PendingWriteOff,
  type StockMovement,
} from "@/offline";
import { LocalStockError, newClientReference, toLocalTimestamp } from "./sales.service";

/**
 * Baixa de estoque pelo PDV: saída de mercadoria **sem venda** — consumo
 * interno, perda ou doação.
 *
 * O desenho é o mesmo de `registerSale`, e de propósito: um caminho de escrita
 * só, que decide sozinho entre servidor e fila local, debita o estoque local nos
 * dois casos e propaga o "não" que o servidor respondeu. Quem já entendeu a
 * venda não precisa aprender nada novo aqui.
 *
 * O que muda:
 *
 * - **Nada é impresso.** Baixa não tem comprovante — decisão do dono.
 * - **Não há sessão de caixa no corpo.** Quem a resolve é o servidor, e só
 *   quando a empresa usa controle de caixa. Baixa é movimento de estoque, não de
 *   dinheiro: ela nunca entra em valor de gaveta.
 * - **Inventário não passa por aqui.** O motivo é gerado só pela importação da
 *   contagem, que é o único caminho autorizado a baixar acima do saldo em lote.
 *
 * Regras do domínio em `Uaus.Backend.Api/docs/baixas-de-estoque.md`.
 */

/** Um produto e quanto sai dele. */
export type WriteOffItemInput = {
  productId: number;
  quantity: number;
  /** Nome do produto, guardado na fila offline para a lista de pendências. */
  productName?: string;
};

export type RegisterWriteOffPayload = {
  /** Enum `StockWriteOffReason`: Consumo (1), Perda (2) ou Doação (3). */
  reason: number;
  items: WriteOffItemInput[];
  notes?: string | null;
};

/**
 * Resultado do registro de uma baixa.
 *
 * `offline` distingue os dois desfechos, e a tela precisa dos dois: a baixa
 * gravada tem ID no banco, a que ficou na fila só tem a referência do cliente.
 */
export type RegisteredWriteOff = {
  /** ID da baixa no banco, ou `null` quando ela ficou na fila offline. */
  id: number | null;
  /** Chave de idempotência gerada para esta baixa. */
  clientReference: string;
  /** Momento real da baixa, no horário da loja e sem fuso. */
  occurredAt: string;
  reason: number;
  /** Soma das quantidades baixadas. */
  totalQuantity: number;
  /** Verdadeiro quando a baixa foi para a fila em vez de ir ao servidor. */
  offline: boolean;
};

/** Movimentos de estoque correspondentes aos itens da baixa. */
function toStockMovements(items: WriteOffItemInput[]): StockMovement[] {
  return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
}

/** Soma das quantidades baixadas. */
function totalQuantityOf(items: WriteOffItemInput[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Registra a baixa: no servidor quando há conexão, na fila local quando não há.
 *
 * Igual à venda, uma falha de **rede** no meio da requisição também cai para a
 * fila — entre perder a baixa e guardá-la para sincronizar, guardar é sempre
 * melhor — enquanto um erro que o servidor **respondeu** (saldo insuficiente,
 * produto excluído) é propagado, porque enfileirá-lo só adiaria o mesmo "não".
 *
 * Nos dois caminhos o estoque local é debitado, para que a base local acompanhe
 * o balcão e a próxima venda já veja o saldo certo. Sem isso o PDV continuaria
 * vendendo offline a mercadoria que acabou de ser jogada fora.
 *
 * @param payload Baixa montada no diálogo.
 * @param options `offline: true` grava direto na fila, sem tentar a rede.
 * @throws {LocalStockError} Quando a baixa offline não cabe no estoque local.
 * @throws {ApiError} Quando o servidor recusa a baixa.
 */
export async function registerWriteOff(
  payload: RegisterWriteOffPayload,
  options: { offline?: boolean } = {},
): Promise<RegisteredWriteOff> {
  const clientReference = newClientReference();
  // O momento real da baixa, capturado agora e não na hora de subir: uma baixa
  // feita durante a queda de internet não pode entrar com o horário em que a
  // conexão voltou. Formato local sem fuso — `toISOString()` a deixaria três
  // horas adiantada no painel.
  const occurredAt = toLocalTimestamp();
  const notes = payload.notes?.trim() || null;

  if (options.offline) {
    return enqueueWriteOff(payload, clientReference, occurredAt, notes);
  }

  try {
    const saved = await registerStockWriteOff({
      reason: payload.reason,
      clientReference,
      occurredAt,
      notes,
      items: payload.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    if (!saved?.id) {
      throw new Error("Não foi possível identificar a baixa registrada.");
    }

    await consumeLocalStock(toStockMovements(payload.items));

    return {
      id: saved.id,
      clientReference,
      occurredAt: readOccurredAt(saved, occurredAt),
      reason: payload.reason,
      totalQuantity: totalQuantityOf(payload.items),
      offline: false,
    };
  } catch (error) {
    // O servidor respondeu recusando: é regra de negócio, não falta de conexão.
    if (error instanceof ApiError) throw error;

    // Qualquer outra falha é rede (fetch abortado, DNS, servidor inalcançável).
    return enqueueWriteOff(payload, clientReference, occurredAt, notes);
  }
}

/** Momento da baixa como o servidor a gravou, caindo para o que o PDV enviou. */
function readOccurredAt(saved: StockWriteOffDto, fallback: string): string {
  return saved.occurredAt || fallback;
}

/**
 * Grava a baixa na fila local e debita o estoque da base local.
 *
 * A conferência de estoque roda antes de qualquer escrita, pela mesma razão da
 * venda: o backend recusa baixa acima do saldo, então enfileirar uma baixa
 * condenada só adiaria a recusa para horas depois — quando ninguém mais lembra
 * qual produto foi realmente jogado fora.
 */
async function enqueueWriteOff(
  payload: RegisterWriteOffPayload,
  clientReference: string,
  occurredAt: string,
  notes: string | null,
): Promise<RegisteredWriteOff> {
  const movements = toStockMovements(payload.items);

  const shortages = await checkLocalStock(movements);
  if (shortages.length > 0) {
    throw new LocalStockError(shortages);
  }

  const writeOff: PendingWriteOff = {
    clientReference,
    occurredAt,
    reason: payload.reason,
    notes,
    items: payload.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      productName: item.productName ?? `Produto #${item.productId}`,
    })),
    status: "pending",
    attempts: 0,
    lastError: null,
    // A baixa debita o estoque local logo abaixo; o marcador acompanha isso para
    // que a sincronização saiba se precisa devolver ou redebitar.
    stockApplied: true,
  };

  // A baixa entra na fila antes do débito: se a gravação falhar, o saldo local
  // continua íntegro. A ordem inversa deixaria o estoque debitado por uma baixa
  // que não existe em lugar nenhum.
  await savePendingWriteOff(writeOff);
  await consumeLocalStock(movements);

  return {
    id: null,
    clientReference,
    occurredAt,
    reason: payload.reason,
    totalQuantity: totalQuantityOf(payload.items),
    offline: true,
  };
}
