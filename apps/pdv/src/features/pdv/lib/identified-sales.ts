import { PAYMENT_STATUS, enumCode, type SaleDto } from "@workspace/api-client-react";

/** Quantas vendas tiveram cliente identificado, de quantas. */
export type IdentifiedSalesCount = { identified: number; total: number };

/**
 * O contador do Desempenho (01/10/2026): "Neste turno: 4 de 13 vendas com
 * cliente identificado". Nasceu no carrinho e foi para o Desempenho a pedido do
 * dono, para poupar a altura da tela HD do caixa.
 *
 * O programa de fidelidade só funciona com o cliente identificado, e a meta do
 * dono é chegar a 30% das vendas de dezembro com cliente. O número à vista lembra
 * o operador de perguntar. Venda cancelada não conta nem em cima nem embaixo:
 * ela não aconteceu.
 */
export function countIdentifiedSales(sales: ReadonlyArray<SaleDto>): IdentifiedSalesCount {
  const valid = sales.filter(
    (sale) => enumCode(sale.paymentStatus, PAYMENT_STATUS) !== PAYMENT_STATUS.Cancelled,
  );
  return {
    identified: valid.filter((sale) => sale.customerId != null).length,
    total: valid.length,
  };
}
