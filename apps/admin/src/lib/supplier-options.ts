import type { SupplierDto } from "@workspace/api-client-react";

const SHOPEE_SUPPLIER_ID = 6;
const supplierNameCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/**
 * Ordena opções de fornecedor para os selects do Admin.
 *
 * A Shopee fica fixa no topo por frequência de uso; os demais nomes seguem a
 * ordem alfabética em português. Uma cópia evita alterar o catálogo em cache.
 */
export function orderSupplierOptions(suppliers: SupplierDto[]): SupplierDto[] {
  return [...suppliers].sort((a, b) => {
    if (a.id === SHOPEE_SUPPLIER_ID) return -1;
    if (b.id === SHOPEE_SUPPLIER_ID) return 1;
    return supplierNameCollator.compare(a.name, b.name);
  });
}
