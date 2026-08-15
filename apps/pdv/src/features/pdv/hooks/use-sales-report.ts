import { useCallback, useState } from "react";
import {
  enumCode,
  PAYMENT_STATUS,
  type CashRegisterSessionDto,
  type CashRegisterSessionSummaryDto,
  type CompanySettingsDto,
  type SaleDto,
} from "@workspace/api-client-react";
import { printSalesReport, resolveStoreInfo } from "@workspace/receipt";
import { describeApiError } from "@workspace/core";
import { useToast } from "@workspace/ui";

export interface UseSalesReportParams {
  /** Sessão de caixa aberta, ou `null` — sem ela não há turno a consolidar. */
  session: CashRegisterSessionDto | null;
  /** Consolidado do caixa vindo da API. */
  summary: CashRegisterSessionSummaryDto | null;
  /** Vendas do turno, já carregadas pela tela. */
  sales: SaleDto[];
  /** Operador logado, usado quando a sessão não guarda o nome. */
  operatorName: string;
  companySettings: CompanySettingsDto;
  /** Nome de cada forma de pagamento por ID, para as vendas antigas. */
  paymentMethodNameById: Record<number, string>;
}

/**
 * Relatório de vendas do turno: consolidado do caixa e a relação das vendas.
 *
 * Os campos do resumo caem para zero quando a API ainda não respondeu, e o
 * esperado em caixa cai para o fundo de troco: um relatório impresso com campo
 * em branco seria assinado por alguém achando que a loja não vendeu nada.
 */
export function useSalesReport({
  session,
  summary,
  sales,
  operatorName,
  companySettings,
  paymentMethodNameById,
}: UseSalesReportParams) {
  const { toast } = useToast();
  const [printingReport, setPrintingReport] = useState(false);

  const printReport = useCallback(async () => {
    if (!session) {
      toast({
        title: "Caixa fechado",
        description: "Abra o caixa para emitir o relatório de vendas.",
        variant: "destructive",
      });
      return;
    }

    setPrintingReport(true);
    try {
      await printSalesReport({
        sessionId: session.id,
        operatorName: session.userName || operatorName,
        openedAt: session.openedAt,
        closedAt: session.closedAt ?? null,
        printedAt: new Date(),
        openingBalance: session.openingBalance,
        summary: {
          salesCount: summary?.salesCount ?? 0,
          cancelledSalesCount: summary?.cancelledSalesCount ?? 0,
          revenue: summary?.revenue ?? 0,
          discounts: summary?.discounts ?? 0,
          itemsCount: summary?.itemsCount ?? 0,
          cashAmount: summary?.cashAmount ?? 0,
          nonCashAmount: summary?.nonCashAmount ?? 0,
          expectedCashAmount: summary?.expectedCashAmount ?? session.openingBalance,
          byPaymentMethod: (summary?.byPaymentMethod ?? []).map((method) => ({
            paymentMethodName: method.paymentMethodName,
            count: method.count,
            amount: method.amount,
          })),
        },
        sales: sales.map((sale) => ({
          id: sale.id,
          createdAt: sale.createdAt,
          total: sale.total,
          cancelled: enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled,
          paymentNames: (sale.payments ?? [])
            .map((payment) => payment.paymentMethodName || paymentMethodNameById[payment.paymentMethodId])
            .filter((name): name is string => Boolean(name)),
        })),
        // Identidade do cadastro da empresa; campo vazio cai no padrão embutido.
        store: resolveStoreInfo(companySettings),
      });
    } catch (error) {
      toast({
        title: "Não foi possível imprimir o relatório",
        description: describeApiError(error),
        variant: "destructive",
      });
    } finally {
      setPrintingReport(false);
    }
  }, [companySettings, operatorName, paymentMethodNameById, sales, session, summary, toast]);

  return {
    /** A impressão está em andamento; o item do menu fica travado. */
    printingReport,
    printReport,
  };
}
