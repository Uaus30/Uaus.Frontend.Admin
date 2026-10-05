/**
 * As marcas da coluna de estoque da listagem (04/10/2026), como o servidor as
 * devolve em `GET /Products/table`. A REGRA de cada uma é do backend
 * (`StockControlRules`); aqui só a escolha da etiqueta.
 */
export type StockSignals = {
  /** Controlado e no mínimo que vale para ele, ou esgotado — o número em vermelho. */
  atMinimumStock?: boolean;
  /** No relatório de estoque baixo. */
  needsRestock?: boolean;
  /** Com compra "A caminho". */
  purchaseInTransit?: boolean;
};

/** A etiqueta embaixo da quantidade, ou nenhuma. */
export type StockTag = "bought" | "buy" | null;

/**
 * Qual etiqueta vai embaixo da quantidade.
 *
 * "Comprado" PREVALECE sobre "Comprar!" (pedido do dono, 04/10/2026): o produto
 * que está no relatório e já tem compra a caminho não pede ação — mostrar
 * "Comprar!" pulsando faria alguém registrar o pedido duas vezes. Compra só
 * Pendente não conta: ainda não foi feita.
 */
export function stockTag(signals: StockSignals): StockTag {
  if (signals.purchaseInTransit) return "bought";
  if (signals.needsRestock) return "buy";
  return null;
}
