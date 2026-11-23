import type { FinancialClosingPreviewDto } from "@workspace/api-client-react";

export type {
  FinancialClosingDto,
  FinancialClosingNextDto,
  FinancialClosingPreviewDto,
  FinancialClosingShareDto,
  FinancialClosingVariableCostDto,
  FinancialClosingWithdrawalPayload,
  FinancialReportFixedCostItemDto,
  FinancialReportFixedCostsDto,
  FinancialReportWriteOffByReasonDto,
} from "@workspace/api-client-react";

export type { Competence, MonthAvailability, MonthOption } from "./month-selection";

/**
 * Etapas do diálogo de novo fechamento (23/11/2026):
 * - `competencia`: escolha do mês/ano + cálculo da prévia (nada é persistido);
 * - `resultado`: o resultado (o lucro) e o caixa do mês, com os custos variáveis;
 * - `saldo`: retiradas por sócio, saldo confirmado e a confirmação.
 */
export type NewClosingStep = "competencia" | "resultado" | "saldo";

/**
 * Campos comuns ao fechamento persistido (`FinancialClosingDto`) e à prévia
 * (`FinancialClosingPreviewDto`) — o que os blocos do resultado, do caixa e do
 * rateio exibem nos dois diálogos.
 */
export type ClosingNumbers = Omit<
  FinancialClosingPreviewDto,
  "fixedCosts" | "warnings" | "isImplantation" | "writeOffsByReason"
>;
