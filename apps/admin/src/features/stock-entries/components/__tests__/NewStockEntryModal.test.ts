import { describe, expect, it } from "vitest";
import type { SupplierDto } from "@workspace/api-client-react";
import { orderStockEntrySuppliers } from "../../supplier-order";

function supplier(id: number, name: string): SupplierDto {
  return { id, name } as SupplierDto;
}

describe("orderStockEntrySuppliers", () => {
  it("deve exibir a Shopee (id 6) primeiro e preservar a ordem dos demais", () => {
    const suppliers = [
      supplier(10, "Fornecedor A"),
      supplier(6, "Shopee"),
      supplier(3, "Fornecedor B"),
    ];

    expect(orderStockEntrySuppliers(suppliers).map(({ id }) => id)).toEqual([6, 10, 3]);
    expect(suppliers.map(({ id }) => id)).toEqual([10, 6, 3]);
  });

  it("deve manter a ordem original quando a Shopee não estiver disponível", () => {
    const suppliers = [supplier(10, "Fornecedor A"), supplier(3, "Fornecedor B")];

    expect(orderStockEntrySuppliers(suppliers)).toEqual(suppliers);
  });
});
