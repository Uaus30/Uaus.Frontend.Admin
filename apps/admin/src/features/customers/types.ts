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
 * Consolidado de compras de um cliente.
 *
 * Os números vêm SOMADOS do servidor (`GET /Customers/summary`). Antes eram
 * calculados no navegador a partir da tabela de vendas inteira — a tela baixava
 * todas as vendas da loja para preencher três colunas de quinze linhas, e parava
 * de abrir ao passar de 20 mil vendas, onde a varredura paginada lança.
 */
export interface CustomerStats {
  totalPurchases: number;
  purchaseCount: number;
  /** Nula para quem nunca comprou — diferente de "comprou hoje". */
  lastPurchaseAt: string | null;
}
