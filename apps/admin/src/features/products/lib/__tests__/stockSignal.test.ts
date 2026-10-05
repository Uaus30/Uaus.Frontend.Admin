import { describe, expect, it } from "vitest";
import { stockTag } from "../stockSignal";

describe("stockTag — a etiqueta embaixo da quantidade (04/10/2026)", () => {
  it("no relatório de estoque baixo, pede compra", () => {
    expect(stockTag({ needsRestock: true })).toBe("buy");
  });

  it("compra a caminho prevalece: o pedido já foi feito", () => {
    expect(stockTag({ needsRestock: true, purchaseInTransit: true })).toBe("bought");
    expect(stockTag({ purchaseInTransit: true })).toBe("bought");
  });

  it("no mínimo, mas fora do relatório (sem demanda), não ganha etiqueta — só o vermelho", () => {
    expect(stockTag({ atMinimumStock: true })).toBeNull();
    expect(stockTag({})).toBeNull();
  });
});
