/**
 * Estado dos controles de filtro da listagem de baixas.
 *
 * Tudo é string porque é o que os `Select` e o `DateRangePicker` devolvem; a
 * tradução para os parâmetros da API fica em `buildStockWriteOffQuery`.
 */
export type StockWriteOffFilterState = {
  /** Código do motivo, ou `"all"` para não filtrar. */
  reason: string;
  /** Código da situação, ou `"all"` para não filtrar. */
  status: string;
  /** Data inicial em `yyyy-MM-dd`, ou string vazia. */
  startDate: string;
  /** Data final em `yyyy-MM-dd`, ou string vazia. */
  endDate: string;
  /** ID de quem registrou, ou `"all"` para não filtrar. */
  userId: string;
};

/**
 * Uma linha do rascunho da baixa: um produto e quanto sai dele.
 *
 * Nome, código de barras e saldo são cópias do momento da escolha, só para a
 * tela ter o que mostrar sem consultar o catálogo de novo. Só `productId` e
 * `quantity` chegam ao backend.
 */
export type StockWriteOffDraftItem = {
  productId: number;
  productName: string;
  barcode: string | null;
  /** Saldo do produto quando ele entrou no rascunho — informativo. */
  stock: number;
  quantity: number;
};

/** Opção de um `Select` de filtro. */
export type StockWriteOffSelectOption = {
  value: string;
  label: string;
};
