import { describe, expect, it } from "vitest";
import { applyStockControlChoice, stockControlPayload, viewStockControl } from "../stockControlChoice";

describe("viewStockControl", () => {
  it("sem escolha na tela, mostra o que os produtos têm — ausente vale ligado", () => {
    expect(viewStockControl(null, [{}, { stockControlEnabled: true }]).state).toBe("on");
  });

  it("todas as variações desligadas: desligado, com o motivo", () => {
    const view = viewStockControl(null, [
      { stockControlEnabled: false, stockControlDisabledReason: "EndOfLine" },
      { stockControlEnabled: false, stockControlDisabledReason: "EndOfLine" },
    ]);

    expect(view).toEqual({ state: "off", reason: "EndOfLine", disabledCount: 2, total: 2 });
  });

  it("parte das variações desligada pelo relatório: misto", () => {
    const view = viewStockControl(null, [{ stockControlEnabled: false }, { stockControlEnabled: true }, {}]);

    expect(view.state).toBe("mixed");
    expect(view.disabledCount).toBe(1);
    expect(view.total).toBe(3);
  });

  it("a escolha feita na tela manda sobre o que foi carregado", () => {
    const view = viewStockControl({ enabled: false, reason: "Seasonal" }, [{ stockControlEnabled: true }]);

    expect(view).toEqual({ state: "off", reason: "Seasonal", disabledCount: 1, total: 1 });
  });
});

describe("stockControlPayload", () => {
  it("sem escolha na tela não manda nada: o servidor mantém o gravado", () => {
    expect(stockControlPayload(null)).toEqual({});
  });

  it("religar não leva motivo", () => {
    expect(stockControlPayload({ enabled: true, reason: "EndOfLine" })).toEqual({
      stockControlEnabled: true,
      stockControlDisabledReason: null,
    });
  });

  it("desligar leva o motivo escolhido", () => {
    expect(stockControlPayload({ enabled: false, reason: "InternalUse" })).toEqual({
      stockControlEnabled: false,
      stockControlDisabledReason: "InternalUse",
    });
  });
});

describe("applyStockControlChoice", () => {
  it("o produto passa a ter o que foi salvo", () => {
    expect(
      applyStockControlChoice({ id: 1, stockControlEnabled: true }, { enabled: false, reason: "Other" }),
    ).toEqual({ id: 1, stockControlEnabled: false, stockControlDisabledReason: "Other" });
  });
});
