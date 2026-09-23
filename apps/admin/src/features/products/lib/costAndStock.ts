import { formatCurrency, formatQuantity } from "@workspace/core";
import type { ProductDto } from "@workspace/api-client-react";

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
