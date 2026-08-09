/** Dados de identificação da loja impressos no cabeçalho do cupom. */
export interface ReceiptStore {
  /** Nome fantasia, em destaque logo abaixo da logo. */
  name: string;
  /** Endereço quebrado em linhas já prontas para impressão. */
  addressLines: string[];
  /** Telefone de contato, impresso como está (rótulo incluso, se houver). */
  phone?: string;
  /** Documento do estabelecimento, impresso como está (rótulo incluso, se houver). */
  document?: string;
}

/**
 * Identidade da loja no formato do cadastro da empresa (`CompanySettings`).
 *
 * É o que os apps passam em `ReceiptData.store` depois de `resolveStoreInfo`:
 * os nomes dos campos espelham o contrato da API, e a conversão para o formato
 * de impressão (`ReceiptStore`) — endereço em linhas, rótulo "CNPJ: " — fica
 * por conta do próprio cupom.
 */
export interface StoreInfo {
  /** Nome fantasia impresso em destaque no cabeçalho. */
  storeName: string;
  /** Endereço em linha única, como cadastrado. */
  addressLine: string;
  /** Telefone de contato, impresso exatamente como cadastrado. */
  phone: string;
  /** CNPJ cru, sem rótulo — o cupom imprime com o prefixo "CNPJ: ". */
  document: string;
  /** Mensagem de agradecimento impressa no rodapé de todo cupom. */
  receiptFooterMessage: string;
}

/** Uma linha de produto do cupom. */
export interface ReceiptItem {
  /** Descrição impressa do produto. */
  name: string;
  quantity: number;
  /** Preço unitário efetivamente praticado (já líquido de desconto de item). */
  unitPrice: number;
  /** Unidade de medida exibida ao lado da quantidade. */
  unit?: string;
  /**
   * Código de barras, impresso acima da descrição. Omitido quando a origem não
   * o conhece — é o caso da reimpressão a partir da API, cujo item de venda não
   * carrega o código.
   */
  barcode?: string | null;
}

/** Uma forma de pagamento usada na venda. */
export interface ReceiptPayment {
  name: string;
  /** Valor pago nesta forma. Nulo quando a origem não informou a divisão. */
  amount: number | null;
  /** Número de parcelas; só é impresso quando maior que 1. */
  installments?: number;
}

/** Tudo que o cupom precisa para ser montado. */
export interface ReceiptData {
  /**
   * Número da venda, impresso como "Cupom".
   *
   * Aceita texto porque a venda registrada offline ainda não tem ID no banco: o
   * PDV imprime um número provisório ("OFF-14") que não colide com nenhum cupom
   * definitivo. Depois da sincronização, a reimpressão sai com o número real.
   */
  saleId: number | string;
  /** Data/hora da venda. */
  createdAt: string | Date;
  /** Operador do caixa. Omitido quando a origem não sabe quem vendeu. */
  operatorName?: string | null;
  /**
   * CPF/CNPJ do consumidor. É a única identificação impressa — ausente, o cupom
   * sai como "CONSUMIDOR: Não identificado".
   */
  customerDocument?: string | null;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  /** Desconto aplicado sobre o total da venda. */
  discount?: number;
  /** Total final da venda. */
  total: number;
  /** Valor em dinheiro recebido do cliente, quando houver. */
  amountReceived?: number | null;
  /** Troco devolvido. */
  change?: number | null;
  notes?: string | null;
  /** Marca o cupom como segunda via (reimpressão). */
  reprint?: boolean;
  /** Carimba o cupom como venda cancelada. */
  cancelled?: boolean;
  /**
   * Carimba o cupom como venda registrada sem conexão, com número provisório.
   * Avisa o operador de que aquele cupom ainda depende de sincronização.
   */
  offline?: boolean;
  /**
   * Sobrescreve os dados da loja para este cupom.
   *
   * Aceita a identidade completa vinda do cadastro (`StoreInfo`, resolvida por
   * `resolveStoreInfo`) ou a sobrescrita avulsa por campo do cabeçalho.
   */
  store?: Partial<ReceiptStore> | StoreInfo;
}
