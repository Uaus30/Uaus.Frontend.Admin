/**
 * Interface que representa um Cliente do sistema.
 */
export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  address: string | null;
  createdAt: string;
}

/**
 * Interface que define os campos do formulário de cadastro/edição de Clientes.
 */
export interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  document: string;
  address: string;
}

/**
 * Interface para as estatísticas de compras calculadas do cliente.
 */
export interface CustomerStats {
  totalPurchases: number;
  purchaseCount: number;
}
