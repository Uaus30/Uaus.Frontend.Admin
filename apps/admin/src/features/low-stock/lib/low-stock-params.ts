import { suggestedRestockQuantity } from "@/lib/stock-control";
import { NEW_PURCHASE_QUANTITY_PARAM } from "@/features/purchases/purchases-route";
import type { LowStockItem } from "../types";

/**
 * Peças de consulta que as duas telas da feature dividem — o relatório de
 * estoque baixo e a Lista de Compras (14/10/2026). Moravam dentro do
 * `useLowStock`; a segunda tela as copiaria, e as cópias divergiriam no
 * primeiro ajuste.
 */

/**
 * O texto digitado vira filtro só se for inteiro positivo: campo vazio, zero e
 * lixo digitado voltam ao relatório inteiro, e um dígito errado não pode
 * esvaziar a tela.
 */
export function positiveIntegerFilter(text: string): number | undefined {
  const value = Number(text);
  return text.trim() && Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Fornecedor do último lote na URL da compra, quando o produto tem um — a
 * compra de reposição abre com ele já escolhido.
 */
export function supplierQuery(item: Pick<LowStockItem, "supplierId">): string {
  return item.supplierId ? `&fornecedor=${item.supplierId}` : "";
}

/**
 * Na linha do produto julgado pelo total (15/10/2026), a quantidade sugerida
 * vai na URL: a tela de Compras abre pela variação que representa o grupo, e
 * sugerir pelo saldo e pela demanda DELA compraria para uma cor só. Lá, a grade
 * a reparte entre as variações, primeiro as com menos saldo
 * (`spreadRestockQuantity`). Fora da linha de grupo, a tela calcula como
 * sempre.
 */
export function quantityQuery(
  item: Pick<LowStockItem, "isGroup" | "stock" | "minStock" | "dailyDemand">,
): string {
  return item.isGroup ? `&${NEW_PURCHASE_QUANTITY_PARAM}=${suggestedRestockQuantity(item)}` : "";
}
