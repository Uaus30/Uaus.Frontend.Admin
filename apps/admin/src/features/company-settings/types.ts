import type { CompanySettingsDto } from "@workspace/api-client-react";

/**
 * Tipos da feature de configurações da empresa.
 *
 * O DTO vem do api-client; aqui só o que é de formulário.
 */
export type { CompanySettingsDto };

/**
 * Valores do formulário.
 *
 * Todos os campos são string porque vêm de `<input>` — inclusive os numéricos,
 * que só viram número na hora de enviar. Guardar número no estado obrigaria a
 * decidir o que fazer com o campo vazio a cada tecla digitada.
 */
export type CompanySettingsForm = {
  storeName: string;
  document: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  zipCode: string;
  receiptFooter: string;
  /** Teto de desconto do operador Seller, em pontos percentuais. */
  maxSellerDiscountPercentage: string;
  /** A loja controla abertura e fechamento de caixa. */
  requiresCashRegisterSession: boolean;
};
