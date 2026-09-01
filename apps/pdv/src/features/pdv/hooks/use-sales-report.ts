import { useCallback, useState } from "react";
import type {
  CashRegisterSessionDto,
  CashRegisterSessionSummaryDto,
  CompanySettingsDto,
  SaleDto,
} from "@workspace/api-client-react";
import { printSalesReport, resolveStoreInfo, type SalesReportData } from "@workspace/receipt";
import { describeApiError } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { summarizeSalesForReport, toReportSales } from "@/lib/sales-report";

export interface UseSalesReportParams {
  /** Sessão de caixa aberta, ou `null` — sem ela o relatório é o do dia. */
  session: CashRegisterSessionDto | null;
  /** Consolidado do caixa vindo da API. */
  summary: CashRegisterSessionSummaryDto | null;
  /** Vendas do turno, já carregadas pela tela. */
  sessionSales: SaleDto[];
  /** Vendas do dia da loja — o relatório da loja sem controle de caixa. */
  todaySales: SaleDto[];
  /** Operador logado, usado quando a sessão não guarda o nome. */
  operatorName: string;
  companySettings: CompanySettingsDto;
  /** Nome de cada forma de pagamento por ID, para as vendas antigas. */
  paymentMethodNameById: Record<number, string>;
}

/**
 * Relatório de vendas impresso pelo PDV: consolidado e relação das vendas.
 *
 * Com caixa aberto o relatório é o do TURNO, com a conferência da gaveta que o
 * backend consolida. Sem sessão ele é o do DIA, consolidado aqui a partir das
 * vendas — antes esse caso não imprimia nada: o botão simplesmente recusava a
 * impressão numa loja que nunca vai ter turno, e o operador ficava sem
 * relatório nenhum.
 *
 * Os campos do resumo do turno caem para zero quando a API ainda não respondeu, e
 * o esperado em caixa cai para o fundo de troco: um relatório impresso com campo
 * em branco seria assinado por alguém achando que a loja não vendeu nada.
 */
export function useSalesReport({
  session,
  summary,
  sessionSales,
  todaySales,
  operatorName,
  companySettings,
  paymentMethodNameById,
}: UseSalesReportParams) {
  const { toast } = useToast();
  const [printingReport, setPrintingReport] = useState(false);

  const printReport = useCallback(async () => {
    // Identidade do cadastro da empresa; campo vazio cai no padrão embutido.
    const store = resolveStoreInfo(companySettings);

    const report: SalesReportData = session
      ? {
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
          sales: toReportSales(sessionSales, paymentMethodNameById),
          store,
        }
      : {
          // Sem sessão o recorte é o dia da loja, e o consolidado sai das
          // próprias vendas: não existe resumo de turno para pedir ao backend.
          operatorName,
          printedAt: new Date(),
          summary: summarizeSalesForReport(todaySales, paymentMethodNameById),
          sales: toReportSales(todaySales, paymentMethodNameById),
          store,
        };

    setPrintingReport(true);
    try {
      await printSalesReport(report);
    } catch (error) {
      toast({
        title: "Não foi possível imprimir o relatório",
        description: describeApiError(error),
        variant: "destructive",
      });
    } finally {
      setPrintingReport(false);
    }
  }, [
    companySettings,
    operatorName,
    paymentMethodNameById,
    session,
    sessionSales,
    summary,
    todaySales,
    toast,
  ]);

  return {
    /** A impressão está em andamento; o item do menu fica travado. */
    printingReport,
    printReport,
  };
}
