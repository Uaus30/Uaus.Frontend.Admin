import type { FinancialClosingDto } from "@workspace/api-client-react";

export type {
  FinancialClosingDto,
  FinancialClosingPreviewDto,
  FinancialClosingShareDto,
  FinancialReportFixedCostItemDto,
  FinancialReportFixedCostsDto,
} from "@workspace/api-client-react";

/**
 * Etapas do diálogo de novo fechamento:
 * - `periodo`: escolha do período + cálculo da prévia (nada é persistido);
 * - `previa`: conferência dos números calculados no servidor + confirmação.
 */
export type NewClosingStep = "periodo" | "previa";

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
  | "netProfit"
  | "salesCount"
  | "shares"
>;
