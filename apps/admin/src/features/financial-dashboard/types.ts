/**
 * Tipos do Painel Financeiro.
 *
 * A tela é só de leitura: os DTOs vêm do api-client e são re-exportados aqui
 * para os componentes da feature não dependerem direto do pacote.
 */
export type {
  CapitalContributionDto,
  CapitalContributionPartnerTotalDto,
  CapitalContributionsMonthDto,
  FinancialClosingDto,
  FinancialReportSummaryDto,
  PurchaseBudgetDto,
} from "@workspace/api-client-react";
