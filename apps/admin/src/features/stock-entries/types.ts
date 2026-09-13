/**
 * Tipagem local da feature.
 *
 * O que descreve a RESPOSTA da API não mora aqui: a nota e os itens recebidos
 * são `ReceivedPurchaseEntryDto` do `@workspace/api-client`, que é onde todo DTO
 * de resposta nasce. Havia cópias locais (`StockEntry`, `StockEntryDetails`,
 * `StockEntryItem`) e elas já estavam incompletas — a modal de detalhes lia
 * `userName`, que a cópia não tinha, e por isso a prop era `any`. Saíram em
 * 13/09/2026, junto com a tela de listagem.
 *
 * `NewEntryItem` descrevia o rascunho da nota multi-produto da tela removida;
 * o rascunho que sobrou é o `SimpleEntryForm` do `useProductStockEntries`.
 */

/**
 * Entrada pré-preenchida por uma COMPRA (`features/purchases`).
 *
 * Chega à aba Estoque do produto recém-cadastrado a partir de uma compra de
 * produto novo: fornecedor, quantidade e custo vêm do pedido, e a modal de
 * lançamento abre sozinha com eles. `reference` identifica a compra para a
 * abertura acontecer UMA vez por compra, não a cada render.
 */
export type StockEntryPrefill = {
  reference: string;
  supplierId: number;
  quantity: number;
  unitCost: number;
  notes?: string;
};
