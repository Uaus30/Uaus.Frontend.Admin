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

/** Uma alternativa de resposta do questionário, como o balcão a apresenta. */
export interface LocalCouponQuestionOption {
  optionId: number;
  label: string;
}

/**
 * Uma pergunta do questionário **já resolvida**: o PDV não sabe (nem precisa
 * saber) de que campanha ela veio.
 *
 * É o mesmo formato de `CouponLookupQuestionDto`, o que faz a tela do cupom ter
 * um caminho só para o online e o offline.
 */
export interface LocalCouponQuestion {
  questionId: number;
  label: string;
  /** Resposta obrigatória para aplicar o cupom. */
  isRequired: boolean;
  /** De duas a oito alternativas; no balcão viram botões grandes, sem teclado. */
  options: LocalCouponQuestionOption[];
}

/**
 * Um cupom como ele vem dentro do snapshot — a definição completa e o
 * questionário já resolvido.
 *
 * **`campaignId` não existe aqui de propósito.** A campanha é encontrada pelo
 * código do cupom, e quem fotografa o vínculo é o servidor na gravação. É isso
 * que mantém offline, fila, idempotência e comprovante estáveis a qualquer
 * evolução do modelo de campanha.
 */
export interface PdvSnapshotCoupon {
  couponId: number;
  code: string;
  description?: string | null;
  /** Enum `CouponDiscountType` da API — pode vir como número ou nome. */
  discountType: number | string;
  discountValue: number;
  /** Início da vigência, inclusivo. Instante, nunca data pura. */
  validFrom: string;
  /** Fim da vigência, inclusivo. Ausente/nulo = sem prazo. */
  validUntil?: string | null;
  /**
   * Usos que restavam **no instante em que o snapshot foi gerado**. Nulo =
   * ilimitado.
   *
   * O nome é escolhido para ninguém o ler como saldo corrente: outro caixa pode
   * ter consumido usos desde então, e este número não é reserva nem promessa.
   */
  remainingAtSnapshot?: number | null;
  /** Questionário a apresentar, ou vazio quando o cupom não tem campanha ativa. */
  questions?: LocalCouponQuestion[];
}

/**
 * Um cupom na base local, já normalizado na instalação do snapshot: código em
 * maiúsculas e tipo de desconto resolvido para o código numérico do enum.
 *
 * Normalizar na carga, e não na consulta, é o mesmo motivo do `searchName` do
 * produto — o balcão consulta a cada tecla, a carga acontece uma vez por turno.
 */
export interface LocalCoupon {
  couponId: number;
  /** Código normalizado em MAIÚSCULAS: é por ele que a busca local casa. */
  code: string;
  description: string | null;
  /** Código do enum `CouponDiscountType`: 1 = Percentual, 2 = Valor fixo. */
  discountType: number;
  discountValue: number;
  validFrom: string;
  validUntil: string | null;
  /** Usos restantes no instante do snapshot. `null` = ILIMITADO, nunca "zero usos". */
  remainingAtSnapshot: number | null;
  questions: LocalCouponQuestion[];
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
  /**
   * Cupons vigentes com o questionário resolvido.
   *
   * Opcional porque um snapshot gerado por um backend anterior a esta feature
   * não traz o campo. Ausente **não** é o mesmo que lista vazia: vazio é "esta
   * loja não tem cupom", ausente é "este caixa não sabe nada sobre cupons" — e a
   * consulta offline recusa de formas diferentes nos dois casos.
   */
  coupons?: PdvSnapshotCoupon[] | null;
}

/** Um item da venda, no formato que a API espera. */
export interface PendingSaleItem {
  productId: number;
  quantity: number;
  /** Preço unitário já líquido do desconto do item. */
  unitPrice: number;
  /**
   * Desconto unitário concedido, em reais.
   *
   * Vai separado do preço porque `unitPrice + discount` é o que reconstrói o
   * preço de tabela do momento da venda — sem ele não há como auditar desconto
   * nem cupom. Opcional apenas por causa das vendas já enfileiradas antes deste
   * campo existir; leia sempre com `?? 0`.
   */
  discount?: number;
  /**
   * Acréscimo unitário cobrado, em reais — o serviço vendido junto do produto.
   *
   * Já está dentro de `unitPrice`; vai separado pelo mesmo motivo do desconto, e
   * é opcional pelo mesmo motivo também: as vendas enfileiradas antes deste
   * campo existir sobrevivem na base local e sobem sem ele. Leia com `?? 0`.
   */
  surcharge?: number;
  /** Justificativa do acréscimo, impressa no cupom. Ausente quando não houve. */
  surchargeReason?: string | null;
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

/** Uma resposta do questionário, por id. O rótulo exibido é gravado pelo servidor. */
export interface PendingSaleCouponAnswer {
  questionId: number;
  optionId: number;
}

/**
 * O cupom aplicado numa venda da fila. Um bloco, não campos soltos: ou o cupom
 * inteiro veio, ou não veio nenhum. **Um por venda, não cumulativo.**
 *
 * **`discountAmount` JÁ ESTÁ INCLUÍDO em `PendingSale.discount` — NÃO SOMAR.**
 * O desconto da venda continua sendo o total e o cupom é uma parcela dele; somar
 * os dois faria o servidor recusar a venda por total divergente no sync, com o
 * cliente já fora da loja.
 *
 * **Não guarda o valor do carrinho, e sim o abatimento daquele instante.** O que
 * nunca pode ser congelado é o cupom *aplicado na tela* — o percentual precisa
 * ser reconta a cada item bipado. Aqui a venda já fechou: o número gravado é o
 * que saiu impresso no comprovante que o cliente levou, e é ele que o servidor
 * audita.
 *
 * **Sem `campaignId`**, como no payload online: o PDV nunca sabe de onde as
 * perguntas vieram.
 */
export interface PendingSaleCoupon {
  couponId: number;
  /**
   * Código como o operador leu do panfleto. Serve de conferência contra
   * `couponId`: uma base local velha pode trazer um id que hoje pertence a outro
   * código.
   */
  code: string;
  /** Código do enum `CouponDiscountType`: 1 = Percentual, 2 = Valor fixo. */
  discountType: number;
  discountValue: number;
  /** Base do cálculo: subtotal dos itens MENOS o desconto global, nunca o subtotal cru. */
  baseAmount: number;
  /** Reais abatidos. Já incluídos em `discount`, e nunca maiores que `baseAmount`. */
  discountAmount: number;
  answers: PendingSaleCouponAnswer[];
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
  /**
   * Cupom aplicado nesta venda, ou ausente quando não houve cupom.
   *
   * Opcional por causa das vendas já enfileiradas antes deste campo existir:
   * `pendingSales` sobrevive à migração do schema local, então elas sobem sem o
   * bloco — leia sempre com `?? null` e nunca assuma o objeto. O backend também
   * aceita a ausência (`RegisterPdvSaleCouponRequest? Coupon`).
   */
  coupon?: PendingSaleCoupon | null;
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
  /**
   * Cidade e UF impressas na linha abaixo do endereço (ex.: "TAPIRA-PR").
   *
   * Acrescentar campo a este objeto **não** muda o esquema do IndexedDB e não
   * pede `DATABASE_VERSION` novo (ver `docs/offline.md`). Uma cópia gravada por
   * uma versão anterior simplesmente não tem o campo, e o cupom sai sem a linha
   * até o próximo snapshot.
   */
  cityState?: string;
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
