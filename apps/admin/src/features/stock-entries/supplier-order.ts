import type { SupplierDto } from "@workspace/api-client-react";

const SHOPEE_SUPPLIER_ID = 6;

/** Prioriza a Shopee sem alterar a ordem dos demais fornecedores. */
export function orderStockEntrySuppliers(suppliers: SupplierDto[]): SupplierDto[] {
  const shopee = suppliers.find((supplier) => supplier.id === SHOPEE_SUPPLIER_ID);
  if (!shopee) return suppliers;

  return [shopee, ...suppliers.filter((supplier) => supplier.id !== SHOPEE_SUPPLIER_ID)];
}
