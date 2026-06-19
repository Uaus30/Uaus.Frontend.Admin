/**
 * Representa uma transação de venda básica.
 */
export type Sale = {
  /** ID único da venda */
  id: number;
  /** ID do cliente associado, null se for Consumidor Final */
  customerId: number | null;
  /** Desconto concedido em reais (R$) */
  discount: number;
  /** Enum identificador do método de pagamento */
  paymentMethod: number;
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
  /** Preço unitário praticado na transação */
  unitPrice: number;
  /** Subtotal calculado para o item (quantity * unitPrice) */
  subtotal: number;
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
