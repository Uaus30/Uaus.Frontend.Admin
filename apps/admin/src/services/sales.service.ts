import {
  apiDelete,
  createCompleteSale,
  fetchAllPages,
  type CreateCompleteSalePayload,
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

/** Carrega os itens de uma venda específica. */
export async function getSaleItems(saleId: number) {
  return fetchAllPages<SaleItemDto>("/SaleItems", { saleId });
}

export async function createSaleWithItems(payload: CreateCompleteSalePayload) {
  const saleId = await createCompleteSale(payload);
  if (!saleId) {
    throw new Error("Não foi possível identificar a venda criada.");
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
