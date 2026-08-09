import type { FixedCostDto, SaveFixedCostPayload } from "@workspace/api-client-react";

/**
 * Valores do formulário de custo fixo, como digitados nos inputs.
 *
 * As vigências ficam no formato "yyyy-MM" (valor nativo do `<input type="month">`);
 * a conversão para o "yyyy-MM-01" esperado pelo backend acontece só no submit.
 */
export type FixedCostForm = {
  name: string;
  /** Valor mensal cru do input numérico (string vazia = não preenchido). */
  monthlyAmount: string;
  /** Competência de início da vigência ("yyyy-MM"). */
  startsOn: string;
  /** Competência final ("yyyy-MM") ou string vazia para custo ainda vigente. */
  endsOn: string;
  notes: string;
};

export type { FixedCostDto, SaveFixedCostPayload };
