import { fetchAllPages, type SaleDto, type SaleItemDto } from "@workspace/api-client-react";

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

/**
 * Carrega os itens de uma venda específica.
 *
 * Aqui já houve um `deleteSaleWithItems`, que apagava os itens um a um e depois
 * a venda. Saiu em 06/10/2026: venda registrada não se exclui — no máximo se
 * cancela, com motivo (`cancelSale` do api-client) —, e a API não tem mais a rota.
 */
export async function getSaleItems(saleId: number) {
  return fetchAllPages<SaleItemDto>("/SaleItems", { saleId });
}
