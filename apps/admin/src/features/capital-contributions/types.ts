/**
 * Valores do formulário de aporte, como digitados.
 *
 * O valor fica como texto cru do `<Input type="number">` (vazio = não
 * preenchido) e o sócio como string do `<Select>`; a conversão para o payload
 * acontece só no submit.
 */
export type CapitalContributionForm = {
  /** Data do aporte, `"yyyy-MM-dd"` — nasce hoje. */
  contributionDate: string;
  /** Id do sócio, como string do select. */
  partnerId: string;
  amount: string;
  notes: string;
};

/** Sócio que o select oferece. */
export type PartnerOption = { id: number; name: string };

export type {
  CapitalContributionDto,
  CapitalContributionPartnerTotalDto,
  CapitalContributionsMonthDto,
  PurchaseBudgetDto,
  SaveCapitalContributionPayload,
} from "@workspace/api-client-react";
