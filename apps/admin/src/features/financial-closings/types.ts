import type { FinancialClosingDto } from "@workspace/api-client-react";

export type {
  FinancialClosingDto,
  FinancialClosingPreviewDto,
  FinancialClosingShareDto,
  FinancialClosingVariableCostDto,
  FinancialReportFixedCostItemDto,
  FinancialReportFixedCostsDto,
} from "@workspace/api-client-react";

export type { Competence, MonthAvailability, MonthOption } from "./month-selection";

/**
 * Etapas do diálogo de novo fechamento:
 * - `competencia`: escolha do mês/ano + cálculo da prévia (nada é persistido);
 * - `previa`: conferência dos números calculados no servidor + confirmação.
 */
export type NewClosingStep = "competencia" | "previa";

/**
 * Campos financeiros comuns ao fechamento persistido (`FinancialClosingDto`) e
 * à prévia (`FinancialClosingPreviewDto`) — é o que o resumo compartilhado
 * entre os dois diálogos precisa exibir.
 */
export type ClosingNumbers = Pick<
  FinancialClosingDto,
  | "periodStart"
  | "periodEnd"
  | "revenue"
  | "discounts"
  | "cogsCost"
  | "grossProfit"
  | "purchasesTotal"
  | "writeOffLossesTotal"
  | "fixedCostsTotal"
  | "variableCostsTotal"
  | "netProfit"
  | "salesCount"
  | "shares"
  | "variableCosts"
>;
