/**
 * Tipos da base local do PDV.
 *
 * Os tipos de snapshot espelham os DTOs de `GET /Pdv/snapshot`; os de fila são
 * exclusivos do navegador. O contrato dos endpoints está documentado em
 * `Uaus.Backend.Api/docs/pdv-offline.md`.
 */

/** Produto vendável, com o estoque local (que a venda offline vai debitando). */
export interface LocalProduct {
  id: number;
  name: string;
  barcode: string;
  price: number;
  /** Estoque local: começa no valor do snapshot e é debitado a cada venda. */
  stock: number;
  /** Enum ProductStatus da API — pode vir como número ou nome. */
  status: number | string;
  productGroupId: number;
  /** Nome em minúsculas, gravado para a busca local não precisar normalizar a cada tecla. */
  searchName: string;
}

/** Forma de pagamento local, com os parcelamentos que geram taxa. */
export interface LocalPaymentMethod {
  id: number;
  name: string;
  installments: LocalPaymentMethodInstallment[];
}

export interface LocalPaymentMethodInstallment {
  id: number;
  installmentNumber: number;
  feePercentage: number;
}

/** Cliente cadastrado, para identificar o consumidor sem internet. */
export interface LocalCustomer {
  id: number;
  name: string;
  document: string | null;
  phone: string | null;
  /** Nome em minúsculas, para a busca local. */
  searchName: string;
}

/** Resposta de `GET /Pdv/snapshot`. */
export interface PdvSnapshot {
  schemaVersion: number;
  generatedAt: string;
  products: Array<{
    id: number;
    name: string;
    barcode: string;
    price: number;
    stock: number;
    status: number | string;
    productGroupId: number;
  }>;
  paymentMethods: LocalPaymentMethod[];
  customers: Array<{
    id: number;
    name: string;
    document: string | null;
    phone: string | null;
  }>;
}

/** Um item da venda, no formato que a API espera. */
export interface PendingSaleItem {
  productId: number;
  quantity: number;
  /** Preço unitário já líquido do desconto do item. */
  unitPrice: number;
  /** Nome do produto no momento da venda, para o cupom e a lista de pendências. */
  productName: string;
}

/** Uma forma de pagamento da venda, no formato que a API espera. */
export interface PendingSalePayment {
  paymentMethodId: number;
  paymentMethodInstallmentId: number | null;
  amount: number;
  installments: number;
  transactionFee: number;
  /** Nome da forma no momento da venda, para o cupom e a lista de pendências. */
  paymentMethodName: string;
}

/**
 * Situação de uma venda na fila local.
 *
 * `pending` volta a ser tentada a cada sincronização. `failed` é uma venda que o
 * backend recusou (estoque insuficiente, produto excluído): ela **não** é
 * retentada automaticamente, porque repetir uma recusa determinística só gera
 * ruído — precisa de decisão do operador.
 */
export type PendingSaleStatus = "pending" | "failed";

/** Uma venda registrada offline, esperando sincronização. */
export interface PendingSale {
  /** Chave de idempotência gerada no caixa (UUID). É a chave primária da store. */
  clientReference: string;
  /** Número provisório impresso no cupom, sequencial por caixa. */
  offlineNumber: number;
  /** Momento real da venda no balcão, em ISO. */
  occurredAt: string;
  cashRegisterSessionId: number;
  customerId: number | null;
  /** CPF/CNPJ do consumidor. É a única identificação avulsa que o PDV coleta. */
  customerDocument: string | null;
  total: number;
  discount: number;
  notes: string | null;
  items: PendingSaleItem[];
  payments: PendingSalePayment[];
  status: PendingSaleStatus;
  /** Quantas vezes esta venda já foi enviada. */
  attempts: number;
  /** Motivo da última recusa, quando `status` é `failed`. */
  lastError: string | null;
  /**
   * O estoque local está debitado por esta venda.
   *
   * Nasce `true` (a venda debita ao entrar na fila) e vira `false` quando o
   * servidor a recusa, porque aí o saldo é devolvido. Sem este marcador, uma
   * venda recusada e depois reenviada com sucesso deixaria o estoque local
   * inflado — o débito original foi desfeito e nada o refaria até o próximo
   * snapshot. O `status` não serve para isso: reenfileirar volta para `pending`.
   */
  stockApplied: boolean;
}

/** Desfecho de uma venda no lote de sincronização, como a API devolve. */
export type SaleSyncStatus = "Created" | "Duplicated" | "Rejected" | number;

export interface SaleSyncResult {
  clientReference: string;
  status: SaleSyncStatus;
  saleId: number | null;
  message: string | null;
}

export interface SyncSalesResponse {
  syncedAt: string;
  createdCount: number;
  duplicatedCount: number;
  rejectedCount: number;
  results: SaleSyncResult[];
}

/** Resumo de uma rodada de sincronização, para exibir ao operador. */
export interface SyncOutcome {
  /** Vendas gravadas no banco nesta rodada. */
  created: number;
  /** Vendas que já estavam gravadas (reenvio de lote cuja resposta se perdeu). */
  duplicated: number;
  /** Vendas recusadas, que ficaram na fila marcadas para conferência. */
  rejected: number;
  /** Vendas que continuam na fila (recusadas + lotes que nem chegaram a ser enviados). */
  remaining: number;
}
