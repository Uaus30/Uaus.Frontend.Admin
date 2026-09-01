import { enumCode, PAYMENT_STATUS, type SaleDto } from "@workspace/api-client-react";
import { round2 } from "@workspace/core";
import type { SalesReportSale, SalesReportSummary } from "@workspace/receipt";

/** A venda foi cancelada — não entra em nenhum total do relatório. */
export function isCancelledSale(sale: SaleDto): boolean {
  return enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled;
}

/**
 * Consolida uma lista de vendas no resumo que o relatório imprime.
 *
 * Existe para o relatório do DIA, da loja sem controle de caixa: ali não há
 * turno, e portanto não há o resumo que o backend calcula no fechamento do
 * caixa — sem este cálculo o botão de imprimir não tinha o que imprimir.
 *
 * As vendas canceladas ficam fora de faturamento, desconto, itens e
 * recebimentos, e são contadas à parte: o relatório precisa bater com o dinheiro
 * que entrou, e o cancelamento devolveu o dele.
 *
 * A conferência da gaveta (`cashAmount`, `expectedCashAmount`) NÃO é calculada
 * aqui de propósito: ela depende do fundo de troco da abertura, que só existe
 * onde há turno. O relatório do dia não imprime essa seção.
 *
 * @param sales Vendas do período, como o PDV as recebeu da API.
 * @param paymentMethodNameById Nome de cada forma por ID, para as vendas antigas
 *   que não trazem o nome embutido no pagamento.
 */
export function summarizeSalesForReport(
  sales: SaleDto[],
  paymentMethodNameById: Record<number, string> = {},
): SalesReportSummary {
  const efetivadas = sales.filter((sale) => !isCancelledSale(sale));

  const porForma = new Map<string, { count: number; amount: number }>();
  for (const sale of efetivadas) {
    for (const payment of sale.payments ?? []) {
      const nome =
        payment.paymentMethodName || paymentMethodNameById[payment.paymentMethodId] || "Não informada";
      const atual = porForma.get(nome) ?? { count: 0, amount: 0 };
      porForma.set(nome, {
        count: atual.count + 1,
        // `amount` nulo é venda antiga que não guardou a divisão entre as
        // formas: a contagem vale, o valor não pode ser inventado.
        amount: round2(atual.amount + (payment.amount ?? 0)),
      });
    }
  }

  return {
    salesCount: efetivadas.length,
    cancelledSalesCount: sales.length - efetivadas.length,
    revenue: round2(efetivadas.reduce((soma, sale) => soma + sale.total, 0)),
    discounts: round2(efetivadas.reduce((soma, sale) => soma + (sale.discount ?? 0), 0)),
    itemsCount: efetivadas.reduce(
      (soma, sale) => soma + (sale.items ?? []).reduce((qtd, item) => qtd + item.quantity, 0),
      0,
    ),
    byPaymentMethod: [...porForma.entries()].map(([paymentMethodName, total]) => ({
      paymentMethodName,
      count: total.count,
      amount: total.amount,
    })),
  };
}

/**
 * Converte as vendas na relação impressa no rodapé do relatório.
 *
 * @param sales Vendas do período, das mais recentes para as mais antigas.
 * @param paymentMethodNameById Nome de cada forma por ID, para as vendas antigas.
 */
export function toReportSales(
  sales: SaleDto[],
  paymentMethodNameById: Record<number, string> = {},
): SalesReportSale[] {
  return sales.map((sale) => ({
    id: sale.id,
    createdAt: sale.createdAt,
    total: sale.total,
    cancelled: isCancelledSale(sale),
    paymentNames: (sale.payments ?? [])
      .map((payment) => payment.paymentMethodName || paymentMethodNameById[payment.paymentMethodId])
      .filter((name): name is string => Boolean(name)),
  }));
}
