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
  /**
   * Sessão de caixa da venda, ou `null` quando a loja não usa controle de caixa.
   *
   * Guardada como veio no momento da venda: se a configuração mudar enquanto a
   * venda espera na fila, o que sobe é o turno em que ela realmente aconteceu.
   */
  cashRegisterSessionId: number | null;
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

/** Um produto e quanto sai dele numa baixa de estoque. */
export interface PendingWriteOffItem {
  productId: number;
  quantity: number;
  /** Nome do produto no momento da baixa, para a lista de pendências. */
  productName: string;
}

/**
 * Situação de uma baixa na fila local. Espelha `PendingSaleStatus` e pela mesma
 * razão: uma recusa determinística não é retentada sozinha.
 */
export type PendingWriteOffStatus = "pending" | "failed";

/**
 * Uma baixa de estoque registrada offline, esperando sincronização.
 *
 * Ela mora numa store própria (`pendingWriteOffs`), e não na fila de vendas com
 * um discriminador. Os motivos estão em `offline/pending-write-offs.ts`.
 *
 * Repare no que **não** existe aqui: pagamento, total, desconto, consumidor e
 * número de cupom. Baixa não é venda — não tem dinheiro nem comprovante — e a
 * sessão de caixa também fica de fora porque quem a resolve é o servidor, só
 * quando a empresa usa controle de caixa (ver `docs/baixas-de-estoque.md`).
 */
export interface PendingWriteOff {
  /** Chave de idempotência gerada no caixa (UUID). É a chave primária da store. */
  clientReference: string;
  /**
   * Momento real da baixa no balcão, no horário da loja e sem fuso.
   *
   * É o campo que impede a baixa feita durante a queda de internet de entrar com
   * o horário em que a conexão voltou.
   */
  occurredAt: string;
  /** Enum `StockWriteOffReason` do backend: Consumo (1), Perda (2), Doação (3). */
  reason: number;
  notes: string | null;
  items: PendingWriteOffItem[];
  status: PendingWriteOffStatus;
  /** Quantas vezes esta baixa já foi enviada. */
  attempts: number;
  /** Motivo da última recusa, quando `status` é `failed`. */
  lastError: string | null;
  /**
   * O estoque local está debitado por esta baixa.
   *
   * Mesma mecânica (e mesmo motivo) do `stockApplied` da venda: nasce `true`,
   * vira `false` na recusa junto com a devolução do saldo, e volta a debitar se
   * a baixa acabar entrando num reenvio.
   */
  stockApplied: boolean;
}

/** Resumo de uma rodada de sincronização de baixas, para exibir ao operador. */
export interface WriteOffSyncOutcome {
  /**
   * Baixas que o servidor confirmou nesta rodada.
   *
   * Inclui as que já estavam gravadas: `POST /StockWriteOffs` é idempotente por
   * `clientReference` e devolve a baixa existente com o mesmo desfecho de uma
   * nova, então o PDV não tem como (nem por que) distinguir as duas.
   */
  sent: number;
  /** Baixas recusadas pelo servidor, que ficaram na fila marcadas com o motivo. */
  rejected: number;
  /** Baixas que continuam na fila (recusadas + as que nem chegaram a ser enviadas). */
  remaining: number;
}

/** Resumo de uma rodada que drena as duas filas locais. */
export interface QueueSyncOutcome {
  sales: SyncOutcome;
  writeOffs: WriteOffSyncOutcome;
  /**
   * Tudo que continua na fila local, vendas e baixas somadas.
   *
   * É o número que o fechamento de caixa consulta: qualquer movimento que o
   * servidor ainda não conhece impede o fechamento.
   */
  remaining: number;
}

/** Configurações da empresa guardadas na base local. */
export interface LocalCompanySettings {
  /** A loja controla caixa (abertura e fechamento por turno). */
  usesCashRegister: boolean;
  /**
   * Nome fantasia impresso no cabeçalho do cupom.
   *
   * Os cinco campos de identidade são opcionais porque uma cópia gravada por
   * uma versão anterior do PDV não os tem — nesse caso o cupom cai nos valores
   * padrão embutidos (`resolveStoreInfo`, no pacote de cupom).
   */
  storeName?: string;
  /** Endereço da loja em linha única, como sai impresso no cupom. */
  addressLine?: string;
  /** Telefone de contato, impresso exatamente como cadastrado. */
  phone?: string;
  /** CNPJ cru, sem rótulo — é o cupom que imprime o prefixo "CNPJ: ". */
  document?: string;
  /** Mensagem de agradecimento impressa no rodapé de todo cupom. */
  receiptFooterMessage?: string;
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
