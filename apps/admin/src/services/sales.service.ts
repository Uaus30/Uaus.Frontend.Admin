import {
  apiPost,
  apiDelete,
  extractCreatedId,
  fetchAllPages,
  type SaleDto,
  type SaleItemDto,
} from "@workspace/api-client-react";

/** Forma de pagamento enviada ao registrar uma venda. */
export type SalePaymentInput = {
  paymentMethodId: number;
  paymentMethodInstallmentId?: number | null;
  amount: number;
  installments?: number;
  transactionFee?: number;
};

/** Carrega todas as vendas percorrendo a paginação da API. */
export async function getAllSales() {
  return fetchAllPages<SaleDto>("/Sales");
}

/** Carrega todos os itens de venda do sistema percorrendo a paginação da API. */
export async function getAllSaleItems() {
  return fetchAllPages<SaleItemDto>("/SaleItems");
}

/** Carrega os itens de uma venda específica. */
export async function getSaleItems(saleId: number) {
  return fetchAllPages<SaleItemDto>("/SaleItems", { saleId });
}

/**
 * Registra a venda e depois lança cada item, que é quem baixa o estoque por FIFO
 * no backend. O total é calculado aqui a partir dos itens menos o desconto.
 *
 * @param payload Cliente, desconto, itens e formas de pagamento da venda.
 * @returns O ID da venda criada.
 */
export async function createSaleWithItems(payload: {
  customerId: number | null;
  discount: number;
  payments: SalePaymentInput[];
  paymentStatus: number;
  notes?: string | null;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
  }>;
}) {
  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const total = Math.max(0, Number((subtotal - payload.discount).toFixed(2)));

  const saleResponse = await apiPost<null>("/Sales", {
    customerId: payload.customerId,
    total,
    discount: payload.discount,
    payments: payload.payments.map((payment) => ({
      paymentMethodId: payment.paymentMethodId,
      paymentMethodInstallmentId: payment.paymentMethodInstallmentId ?? null,
      amount: payment.amount,
      installments: payment.installments ?? 1,
      transactionFee: payment.transactionFee ?? 0,
    })),
    paymentStatus: payload.paymentStatus,
    notes: payload.notes?.trim() || null,
  });

  const saleId = extractCreatedId(saleResponse.response);
  if (!saleId) {
    throw new Error("Não foi possível identificar a venda criada.");
  }

  for (const item of payload.items) {
    await apiPost<null>("/SaleItems", {
      saleId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    });
  }

  return saleId;
}

/**
 * Apaga a venda e os seus itens. Remover os itens primeiro devolve ao estoque
 * os lotes que eles haviam consumido.
 */
export async function deleteSaleWithItems(saleId: number) {
  const relatedItems = await getSaleItems(saleId);

  for (const item of relatedItems) {
    await apiDelete<null>(`/SaleItems/${item.id}`);
  }

  await apiDelete<null>(`/Sales/${saleId}`);
}
