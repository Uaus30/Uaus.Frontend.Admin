import { describe, expect, it } from "vitest";
import { derivePurchaseTotals } from "../purchase-totals";

describe("derivePurchaseTotals", () => {
  it("deriva unitarios e percentual dos totais, como o backend", () => {
    // R$ 120 bruto e R$ 100 final em 3 unidades: 40,00 e 33,33 por unidade,
    // desconto de 16,67%. Os mesmos numeros do PurchaseServiceTests.
    expect(derivePurchaseTotals(3, 120, 100)).toEqual({
      unitGross: 40,
      unitFinal: 33.33,
      adjustmentPercent: -16.67,
    });
  });

  it("acrescimo sai positivo", () => {
    expect(derivePurchaseTotals(2, 100, 110).adjustmentPercent).toBe(10);
  });

  it("zera tudo sem quantidade ou sem bruto, em vez de dividir por zero", () => {
    expect(derivePurchaseTotals(0, 100, 100)).toEqual({ unitGross: 0, unitFinal: 0, adjustmentPercent: 0 });
    expect(derivePurchaseTotals(2, 0, 50)).toEqual({ unitGross: 0, unitFinal: 25, adjustmentPercent: 0 });
    expect(derivePurchaseTotals(Number.NaN, Number.NaN, Number.NaN)).toEqual({
      unitGross: 0,
      unitFinal: 0,
      adjustmentPercent: 0,
    });
  });
});
