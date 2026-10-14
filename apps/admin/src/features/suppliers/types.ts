import type { SupplierType } from "@workspace/api-client-react";

/**
 * Interface que representa os campos do formulário de Fornecedores.
 */
export interface SupplierForm {
  name: string;
  corporateName: string;
  document: string;
  salesRepresentative: string;
  phone: string;
  email: string;
  minimumPurchaseValue: string;
  status: string;
  city: string;
  state: string;
  avatarColor: string;
  description: string;
  /** Compra recorrente — filtro da tela de desempenho de fornecedores. */
  isRecurring: boolean;
  /**
   * Tipo do fornecedor (14/10/2026), que substituiu a chave "É um marketplace".
   * Vazio é "não escolhido": o cadastro novo não nasce com tipo pré-escolhido,
   * porque um padrão seria aceito sem ler — e o tipo muda regra de outras telas
   * (link obrigatório na compra, compra pequena que desliga o controle de
   * estoque).
   */
  type: SupplierType | "";
}

// O DTO já existe no contrato — redeclará-lo aqui criava duas verdades sobre a
// mesma resposta do servidor, e as duas features tinham a sua cópia.
export type { EnumOptionDto as EnumOption } from "@workspace/api-client-react";
