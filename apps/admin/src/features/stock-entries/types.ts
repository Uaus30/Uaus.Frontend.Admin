/**
 * Representa um item individual recebido em uma entrada de estoque.
 */
export type StockEntryItem = {
  /** ID do item de recebimento */
  id: number;
  /** Nome do produto recebido */
  productName: string;
  /** Código de barras do produto */
  barcode: string;
  /** Quantidade física recebida */
  quantity: number;
  /** Custo unitário de compra */
  unitCost: number;
  /** Preço de venda configurado para o produto */
  productPrice: number;
  /** Custo total calculado (quantity * unitCost) */
  totalCost: number;
};

/**
 * Representa um registro básico de entrada de estoque no histórico.
 */
export type StockEntry = {
  /** ID único do registro de entrada */
  id: number;
  /** ID do fornecedor correspondente */
  supplierId: number;
  /** Data da entrada física/financeira */
  entryDate: string;
  /** Número da Nota Fiscal ou identificador da nota */
  invoiceNumber: string | null;
  /** Observações internas textuais */
  notes: string | null;
  /** Valor financeiro total consolidado da entrada */
  total: number;
};

/**
 * Representa os detalhes ricos de uma entrada de estoque específica, incluindo seus itens.
 */
export type StockEntryDetails = {
  /** ID do registro de entrada */
  id: number;
  /** Nome do fornecedor */
  supplierName: string;
  /** Data do recebimento */
  entryDate: string;
  /** Número da Nota Fiscal */
  invoiceNumber: string | null;
  /** Observações gerais */
  notes: string | null;
  /** Valor total */
  total: number;
  /** Flag que indica se a nota pode ser cancelada/removida */
  canDelete: boolean;
  /** Lista de itens recebidos nesta nota */
  items: StockEntryItem[];
};

/**
 * O produto da entrada em rascunho — a entrada é de UM produto por vez.
 *
 * Nome, código de barras e estoque são cópias do momento da escolha, só para a
 * tela ter o que mostrar: o produto entra pela busca (`ProductSearchPicker`),
 * então não há mais o catálogo inteiro em memória para procurar o nome depois.
 * Ao backend vão apenas `productId`, `quantity`, `unitCost` e `price`.
 */
export type NewEntryItem = {
  /** ID do produto escolhido na busca */
  productId: number;
  /** Nome do produto, para exibição */
  productName: string;
  /** Código de barras do produto, para conferência */
  barcode: string | null;
  /** Saldo no momento da escolha, para a prévia "X → X+N". `null` se desconhecido. */
  stock: number | null;
  /** Quantidade física */
  quantity: number;
  /** Custo unitário lançado */
  unitCost: number;
  /** Preço de venda lançado */
  price: number;
};
