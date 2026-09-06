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
   * Plataforma com vários vendedores (Shopee, Mercado Livre). Passa a EXIGIR o
   * link do anúncio na compra fora de Pendente.
   */
  isMarketplace: boolean;
}

// O DTO já existe no contrato — redeclará-lo aqui criava duas verdades sobre a
// mesma resposta do servidor, e as duas features tinham a sua cópia.
export type { EnumOptionDto as EnumOption } from "@workspace/api-client-react";
