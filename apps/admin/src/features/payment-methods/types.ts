import type { PaymentMethodDto, PaymentMethodInstallmentDto } from "@workspace/api-client-react";

/**
 * Form value for an installment configuration in the editor modal.
 */
export type InstallmentFormValue = {
  id?: number;
  installmentNumber: number;
  feePercentage: number;
  isActive: boolean;
};

/**
 * Form values for creating or editing a Payment Method.
 */
export type PaymentMethodFormValues = {
  id?: number;
  name: string;
  isActive: boolean;
  installments: InstallmentFormValue[];
};

export type { PaymentMethodDto, PaymentMethodInstallmentDto };
