/**
 * Representa uma transação de venda básica.
 */
export type Sale = {
  /** ID único da venda */
  id: number;
  /** ID do cliente associado, null se for Consumidor Final */
  customerId: number | null;
  /** Consumidor da venda: do cadastro quando há cliente, senão o informado no PDV */
  customerName?: string | null;
  /** CPF/CNPJ do consumidor, do cadastro ou informado no PDV */
  customerDocument?: string | null;
  /** ID do operador que registrou a venda, null nas vendas migradas */
  userId?: number | null;
  /** Nome completo do operador que registrou a venda */
  userName?: string | null;
  /** Desconto concedido em reais (R$) */
  discount: number;
  /** ID da forma de pagamento */
  paymentMethodId?: number | null;
  /** ID do parcelamento da forma de pagamento */
  paymentMethodInstallmentId?: number | null;
  /** Nome da forma de pagamento */
  paymentMethodName?: string | null;
  /** Número de parcelas */
  installments?: number;
  /** Valor da taxa de transação em R$ */
  transactionFee?: number;
  /** Formas de pagamento da venda (uma venda pode ter N formas) */
  payments?: SalePayment[];
  /** Enum identificador do status do pagamento */
  paymentStatus: number;
  /** Observações internas textuais */
  notes: string | null;
  /** Valor financeiro total final da venda */
  total: number;
  /** Data e hora de criação da venda */
  createdAt: string;
};

/**
 * Uma das formas de pagamento usadas em uma venda.
 */
export type SalePayment = {
  /** ID único do pagamento */
  id: number;
  /** ID da venda pai */
  saleId: number;
  /** ID da forma de pagamento */
  paymentMethodId: number;
  /** Nome da forma de pagamento */
  paymentMethodName?: string | null;
  /** ID do parcelamento da forma de pagamento */
  paymentMethodInstallmentId?: number | null;
  /** Valor pago nesta forma; null quando a origem não informou a divisão */
  amount: number | null;
  /** Número de parcelas */
  installments: number;
  /** Taxa de transação em R$ */
  transactionFee: number;
  /** Ordem em que a forma foi informada */
  sequence: number;
};

/**
 * Representa um item contido em uma venda.
 */
export type SaleItem = {
  /** ID único do item */
  id: number;
  /** ID da venda pai */
  saleId: number;
  /** ID do produto correspondente */
  productId: number;
  /** Quantidade vendida */
  quantity: number;
  /** Preço unitário praticado na transação, já líquido do desconto e já com o acréscimo do item */
  unitPrice: number;
  /**
   * Desconto unitário concedido no item, em reais; o preço de tabela era
   * `unitPrice + discount - surcharge`
   */
  discount?: number;
  /**
   * Acréscimo unitário cobrado no item — o serviço vendido junto do produto. Já
   * está dentro de `unitPrice` e não participa de soma nenhuma.
   */
  surcharge?: number;
  /** Justificativa do acréscimo, escrita no ato da venda. */
  surchargeReason?: string | null;
  /** Subtotal calculado para o item (quantity * unitPrice) */
  subtotal: number;
  /** Custo unitário praticado no momento da venda */
  unitCost?: number;
  /** Custo total do item (quantity * unitCost) */
  totalCost?: number;
  /** Lucro do item (subtotal - totalCost) */
  profit?: number;
};

/**
 * Representa uma venda enriquecida com relacionamentos populados (Cliente, Itens e Produto).
 */
export type EnrichedSale = Sale & {
  /** Informações do cliente associado, ou null */
  customer: {
    id: number;
    name: string;
  } | null;
  /** Lista de itens enriquecidos contendo detalhes do produto associado */
  items: Array<
    SaleItem & {
      /** Detalhes do produto associado */
      product: any;
    }
  >;
};

/**
 * Rascunho de item ao registrar nova venda (Checkout).
 */
export type NewSaleDraftItem = {
  /** ID do produto */
  productId: number;
  /** Quantidade */
  quantity: number;
  /** Preço unitário praticado */
  unitPrice: number;
};

/**
 * Rascunho de forma de pagamento ao registrar nova venda (Checkout).
 */
export type NewSaleDraftPayment = {
  /** ID da forma de pagamento */
  paymentMethodId: number;
  /** Valor atribuído a esta forma */
  amount: number;
};
