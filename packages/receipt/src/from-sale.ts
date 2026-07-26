import type { ReceiptData, ReceiptStore } from "./types";

/** Recorte de uma venda da API com o que o cupom precisa. */
export interface SaleLike {
  id: number;
  createdAt: string;
  total: number;
  discount: number;
  notes?: string | null;
  /**
   * Documento do consumidor resolvido pelo backend (do cadastro, quando a venda
   * tem cliente; senão o informado no balcão). É a única identificação impressa.
   */
  customerDocument?: string | null;
  /** Operador que registrou a venda. */
  userName?: string | null;
  paymentMethodName?: string | null;
  installments?: number;
  payments?: Array<{
    paymentMethodId: number;
    paymentMethodName?: string | null;
    amount: number | null;
    installments?: number;
  }> | null;
}

/** Recorte de um item de venda da API. */
export interface SaleItemLike {
  productId: number;
  productName?: string | null;
  quantity: number;
  unitPrice: number;
  /**
   * Código de barras do produto. A API não o devolve no item da venda, então na
   * reimpressão ele fica de fora e a linha do código não é impressa; o campo
   * existe para quem já tiver o dado em mãos poder repassá-lo.
   */
  barcode?: string | null;
}

/** Contexto que a venda sozinha não carrega. */
export interface SaleReceiptContext {
  /** Operador do caixa. Sobrescreve o que veio na venda. */
  operatorName?: string | null;
  /** Documento do consumidor. Sobrescreve o que veio na venda. */
  customerDocument?: string | null;
  /** Nomes das formas de pagamento por ID, para vendas antigas sem `paymentMethodName`. */
  paymentMethodNameById?: Record<number, string>;
  amountReceived?: number | null;
  change?: number | null;
  /** Marca o cupom como segunda via. */
  reprint?: boolean;
  cancelled?: boolean;
  store?: Partial<ReceiptStore>;
}

/**
 * Converte uma venda da API no formato que o cupom consome.
 *
 * Vendas antigas (migradas ou lançadas fora do PDV) podem não ter a coleção de
 * pagamentos preenchida — nesse caso o cupom cai para a forma de pagamento
 * única da própria venda, cobrindo o total.
 *
 * @param sale Venda retornada pela API.
 * @param items Itens da venda.
 * @param context Operador, cliente e demais dados de fora da venda.
 */
export function buildReceiptFromSale(
  sale: SaleLike,
  items: SaleItemLike[],
  context: SaleReceiptContext = {},
): ReceiptData {
  const nameById = context.paymentMethodNameById ?? {};

  const payments =
    sale.payments && sale.payments.length > 0
      ? sale.payments.map((payment) => ({
          name: payment.paymentMethodName || nameById[payment.paymentMethodId] || "Não informado",
          amount: payment.amount,
          installments: payment.installments,
        }))
      : [
          {
            name: sale.paymentMethodName || "Não informado",
            amount: sale.total,
            installments: sale.installments,
          },
        ];

  return {
    saleId: sale.id,
    createdAt: sale.createdAt,
    operatorName: context.operatorName ?? sale.userName ?? null,
    customerDocument: context.customerDocument ?? sale.customerDocument ?? null,
    items: items.map((item) => ({
      name: item.productName || `Produto #${item.productId}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      barcode: item.barcode ?? null,
    })),
    payments,
    discount: sale.discount,
    total: sale.total,
    amountReceived: context.amountReceived ?? null,
    change: context.change ?? null,
    notes: sale.notes ?? null,
    reprint: context.reprint,
    cancelled: context.cancelled,
    store: context.store,
  };
}
