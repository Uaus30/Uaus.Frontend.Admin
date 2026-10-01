import { describe, expect, it } from "vitest";
import type { SaleDto } from "@workspace/api-client-react";
import { countIdentifiedSales } from "../identified-sales";

const sale = (customerId: number | null, paymentStatus: string | number = "Paid") =>
  ({ id: 1, customerId, paymentStatus }) as unknown as SaleDto;

describe("countIdentifiedSales", () => {
  it("conta as vendas com cliente sobre as vendas do período", () => {
    expect(countIdentifiedSales([sale(7), sale(null), sale(9), sale(null)])).toEqual({
      identified: 2,
      total: 4,
    });
  });

  it("venda cancelada não conta, nem com cliente", () => {
    expect(countIdentifiedSales([sale(7, "Cancelled"), sale(null, 5), sale(3)])).toEqual({
      identified: 1,
      total: 1,
    });
  });

  it("sem vendas, zero de zero", () => {
    expect(countIdentifiedSales([])).toEqual({ identified: 0, total: 0 });
  });
});
