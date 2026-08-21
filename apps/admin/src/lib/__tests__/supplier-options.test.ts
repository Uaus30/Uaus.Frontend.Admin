import { describe, expect, it } from "vitest";
import type { SupplierDto } from "@workspace/api-client-react";
import { orderSupplierOptions } from "../supplier-options";

function supplier(id: number, name: string): SupplierDto {
  return { id, name } as SupplierDto;
}

describe("orderSupplierOptions", () => {
  it("deve manter a Shopee primeiro e ordenar os demais nomes alfabeticamente", () => {
    const suppliers = [
      supplier(10, "Zeta"),
      supplier(3, "Água"),
      supplier(6, "Shopee"),
      supplier(4, "abacate"),
    ];

    expect(orderSupplierOptions(suppliers).map(({ id }) => id)).toEqual([6, 4, 3, 10]);
    expect(suppliers.map(({ id }) => id)).toEqual([10, 3, 6, 4]);
  });

  it("deve ordenar alfabeticamente quando a Shopee não estiver disponível", () => {
    const suppliers = [supplier(10, "Zeta"), supplier(3, "Água"), supplier(4, "abacate")];

    expect(orderSupplierOptions(suppliers).map(({ id }) => id)).toEqual([4, 3, 10]);
  });
});
