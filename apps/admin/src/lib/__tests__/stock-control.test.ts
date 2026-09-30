import { describe, expect, it } from "vitest";
import {
  forecastStatusLabel,
  outOfControlLabel,
  stockControlReasonLabel,
  suggestedRestockQuantity,
} from "../stock-control";

describe("suggestedRestockQuantity", () => {
  it("cobre 60 dias da demanda prevista, descontado o saldo", () => {
    // 0,5 por dia × 60 = 30; com 4 em casa, compra 26.
    expect(suggestedRestockQuantity({ stock: 4, minStock: 0, dailyDemand: 0.5 })).toBe(26);
  });

  it("arredonda a demanda para cima: fração de unidade não se compra", () => {
    expect(suggestedRestockQuantity({ stock: 0, dailyDemand: 0.04 })).toBe(3);
  });

  it("recompõe o mínimo próprio quando ele pede mais que a demanda", () => {
    expect(suggestedRestockQuantity({ stock: 1, minStock: 10, dailyDemand: 0.05 })).toBe(9);
  });

  it("nunca sugere menos de uma unidade", () => {
    expect(suggestedRestockQuantity({ stock: 200, minStock: 0, dailyDemand: 1 })).toBe(1);
    expect(suggestedRestockQuantity({})).toBe(1);
  });

  it("saldo negativo entra na conta: o que falta repor é maior", () => {
    expect(suggestedRestockQuantity({ stock: -2, dailyDemand: 0.1 })).toBe(8);
  });
});

describe("rótulos do controle de estoque", () => {
  it("dá nome ao motivo e à classificação, e vazio para o que não existe", () => {
    expect(stockControlReasonLabel("EndOfLine")).toBe("Fim de linha");
    expect(stockControlReasonLabel(null)).toBe("");
    expect(forecastStatusLabel("LowTurnover")).toBe("Giro baixo");
    expect(forecastStatusLabel(undefined)).toBe("");
  });

  it("explica por que o produto está fora do controle", () => {
    expect(outOfControlLabel({ stockControlEnabled: false, stockControlDisabledReason: "Seasonal" })).toBe(
      "Desligado · Sazonal",
    );
    expect(outOfControlLabel({ stockControlEnabled: false })).toBe("Desligado");
    expect(outOfControlLabel({ stockControlEnabled: true, forecastStatus: "LowTurnover" })).toBe(
      "Giro baixo",
    );
    expect(outOfControlLabel({ stockControlEnabled: true, forecastStatus: "Controlled" })).toBe("");
  });
});
