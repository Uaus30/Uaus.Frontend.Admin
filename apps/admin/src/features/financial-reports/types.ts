/**
 * Tipos da feature de Relatórios Financeiros.
 *
 * A tela é somente leitura: não há formulários, apenas o filtro de período e os
 * DTOs do resumo vindos do api-client, re-exportados aqui para os componentes
 * da feature não dependerem direto do pacote.
 */

/** Período filtrado do relatório — strings `yyyy-MM-dd`, como trafegam na API. */
export interface FinancialReportPeriodFilter {
  startDate: string;
  endDate: string;
}

export type {
  FinancialReportSummaryDto,
  FinancialPeriodTotalsDto,
  FinancialReportWriteOffsDto,
  FinancialReportWriteOffByReasonDto,
  FinancialReportFixedCostsDto,
  FinancialReportFixedCostItemDto,
  PartnerDistributionItemDto,
} from "@workspace/api-client-react";
