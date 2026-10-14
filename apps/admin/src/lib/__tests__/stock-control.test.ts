import { describe, expect, it } from "vitest";
import {
  forecastStatusLabel,
  outOfControlLabel,
  planTripNotice,
  STOCK_CONTROL_DISABLED_REASONS,
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
    // O motivo que só a rotina grava (04/10/2026) fica fora do seletor, mas tem nome.
    expect(stockControlReasonLabel("PoorPerformance")).toBe("Desempenho fraco");
    expect(STOCK_CONTROL_DISABLED_REASONS.map((item) => item.value)).not.toContain("PoorPerformance");
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

describe("motivo Planejar viagem (14/10/2026)", () => {
  it("é escolhível à mão, logo depois de Fim de linha, e tem nome", () => {
    const valores = STOCK_CONTROL_DISABLED_REASONS.map((item) => item.value);
    expect(valores.indexOf("PlanTrip")).toBe(valores.indexOf("EndOfLine") + 1);
    expect(stockControlReasonLabel("PlanTrip")).toBe("Planejar viagem");
    expect(outOfControlLabel({ stockControlEnabled: false, stockControlDisabledReason: "PlanTrip" })).toBe(
      "Desligado · Planejar viagem",
    );
  });
});

describe("planTripNotice", () => {
  const produto = (productId: number, productName: string) => ({ productId, productName });

  it("não avisa nada quando a entrada não desligou ninguém — a API omite o campo", () => {
    expect(planTripNotice(undefined)).toBeNull();
    expect(planTripNotice(null)).toBeNull();
    expect(planTripNotice([])).toBeNull();
  });

  it("fala no singular com um produto só", () => {
    expect(planTripNotice([produto(1, "BALDE 5L [PRETO]")])).toEqual({
      title: "1 produto ficou fora do controle de estoque",
      description:
        "BALDE 5L [PRETO]: motivo Planejar viagem — aparece na Lista de Compras quando tiver boa saída.",
    });
  });

  it("cita até três nomes e resume o resto", () => {
    const aviso = planTripNotice([
      produto(1, "BALDE"),
      produto(2, "BACIA"),
      produto(3, "COPO"),
      produto(4, "PRATO"),
      produto(5, "JARRA"),
    ]);

    expect(aviso?.title).toBe("5 produtos ficaram fora do controle de estoque");
    expect(aviso?.description).toBe(
      "BALDE, BACIA, COPO e mais 2: motivo Planejar viagem — aparecem na Lista de Compras quando tiverem boa saída.",
    );
  });

  it("com exatamente três, cita os três sem o resumo", () => {
    const aviso = planTripNotice([produto(1, "BALDE"), produto(2, "BACIA"), produto(3, "COPO")]);
    expect(aviso?.description.startsWith("BALDE, BACIA, COPO: ")).toBe(true);
  });
});
