import { formatCurrency, formatQuantity } from "@workspace/core";
import type { ProductDto } from "@workspace/api-client-react";
import type { PurchaseContext } from "../types";

/** O que o campo mostra quando não há valor — produto sem entrada de estoque. */
export const SEM_VALOR = "-";

/**
 * O último custo e o estoque atual, como a tela os escreve.
 *
 * "-" quando não há valor, e não "R$ 0,00" ou "0 un": um produto que nunca teve
 * entrada não tem custo nem saldo, e zero diria que tem. O saldo zero de quem já
 * teve entrada (tudo vendido) é valor, e aparece como "0 un".
 */
export function describeCostAndStock(product: Pick<ProductDto, "costPrice" | "stock"> | undefined) {
  if (!product) return { cost: SEM_VALOR, stock: SEM_VALOR };

  const temCusto = product.costPrice > 0;
  return {
    cost: temCusto ? formatCurrency(product.costPrice) : SEM_VALOR,
    stock: temCusto || product.stock !== 0 ? `${formatQuantity(product.stock)} un` : SEM_VALOR,
  };
}

/** Sobre qual custo a margem abaixo do preço é calculada. */
export type MarginBase = {
  cost: number;
  /** A compra de onde o custo veio; `null` quando é o da última entrada. */
  purchaseId: number | null;
};

/**
 * A base da margem abaixo do preço: o custo da última entrada e, no cadastro
 * novo vindo de uma compra, enquanto a entrada dela não foi lançada, o custo
 * unitário da compra (pedido do dono, 23/09/2026).
 *
 * Sem o recurso à compra, a margem sumia justo onde o preço está sendo decidido:
 * o "Último custo" mostra "-" até a entrada existir. O custo da compra é o que a
 * entrada vem preenchida para gravar (`unitFinal`); lançada a entrada, o custo
 * dela assume.
 *
 * @param lastCost Custo da última entrada, do servidor (`product-for-entry`).
 * @param purchase A compra que abriu o cadastro, enquanto ela não foi fechada.
 * @returns A base, ou `null` quando não há custo maior que zero para usar.
 */
export function resolveMarginBase(
  lastCost: number | null | undefined,
  purchase: Pick<PurchaseContext, "purchaseId" | "unitCost"> | null | undefined,
): MarginBase | null {
  if (lastCost != null && lastCost > 0) return { cost: lastCost, purchaseId: null };
  if (purchase && purchase.unitCost > 0) return { cost: purchase.unitCost, purchaseId: purchase.purchaseId };
  return null;
}
