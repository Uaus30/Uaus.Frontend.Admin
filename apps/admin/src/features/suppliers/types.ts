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
}

/**
 * Interface de opção do enum carregado via API.
 */
export interface EnumOption {
  id: number;
  name: string;
  value: string;
  allowSelect: boolean;
}
