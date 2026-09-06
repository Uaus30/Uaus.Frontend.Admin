import { describe, expect, it } from "vitest";
import type { SupplierPerformanceDto, SupplierPerformanceParametersDto } from "@workspace/api-client-react";
import { motivosDaNota } from "../reasons";
import { corDaNota, rotuloDaNota, COR_SEM_NOTA } from "../score";

const PARAMETROS: SupplierPerformanceParametersDto = {
  turnoverTarget: 25,
  hitRateTarget: 45,
  goodMarginThreshold: 40,
  newProductDays: 21,
  healthyCoverageDays: 90,
  hitRateWeight: 0.3,
  marginWeight: 0.25,
  turnoverWeight: 0.25,
  resultWeight: 0.2,
  storeHitRate: 26.5,
  storeMargin: 41.7,
  averageProfitPerSupplier: 191.78,
};

function fornecedor(overrides: Partial<SupplierPerformanceDto> = {}): SupplierPerformanceDto {
  return {
    supplierId: 1,
    supplierName: "Fornecedor",
    avatarColor: null,
    isRecurring: false,
    isMarketplace: false,
    sales: 20,
    units: 40,
    distinctProducts: 10,
    revenue: 1000,
    profit: 420,
    margin: 42,
    averageTicket: 50,
    revenueShare: 30,
    profitShare: 30,
    revenueChangePercent: null,
    stockUnits: 200,
    stockCost: 900,
    turnover: 16.7,
    coverageDays: 100,
    stockReturn: 0.46,
    totalProducts: 40,
    judgedProducts: 30,
    goodProducts: 9,
    lowMarginProducts: 10,
    stalledProducts: 11,
    newProducts: 6,
    inactiveProducts: 4,
    hitRate: 30,
    stalledStockCost: 200,
    lastSaleDate: "2026-09-05T10:00:00",
    daysWithoutSelling: 1,
    lastPurchaseDate: "2026-08-31T00:00:00",
    daysWithoutBuying: 6,
    purchaseCountLastYear: 20,
    purchaseTotalLastYear: 8000,
    averagePurchaseIntervalDays: 18,
    repricedProducts: 0,
    averageCostIncreasePercent: null,
    score: 60,
    scoreBreakdown: { hitRate: 60, margin: 100, turnover: 67, result: 100 },
    dailyRevenue: [10, 0, 20],
    ...overrides,
  };
}

describe("motivosDaNota", () => {
  it("mostra os dois lados quando os dois existem", () => {
    // Um fornecedor bom com três avisos vermelhos passa a impressão errada — e
    // um ruim com três elogios, também.
    const motivos = motivosDaNota(fornecedor(), PARAMETROS, 1, 12);

    expect(motivos).toHaveLength(3);
    expect(motivos.some((m) => m.tipo === "bom")).toBe(true);
    expect(motivos.some((m) => m.tipo === "ruim")).toBe(true);
  });

  it("ordena pelo que DESTOA da loja, não pelo valor do componente", () => {
    // Margem 0,5 pp acima da média não pode virar manchete numa linha que tem
    // 400 dias de estoque parado para contar.
    const motivos = motivosDaNota(
      fornecedor({
        margin: 42.2,
        coverageDays: 400,
        scoreBreakdown: { hitRate: 60, margin: 100, turnover: 12, result: 100 },
      }),
      PARAMETROS,
      1,
      12,
    );

    expect(motivos[0].texto).toContain("400 dias");
  });

  it("quem não vendeu tem um motivo só, e ele fala do dinheiro parado", () => {
    const motivos = motivosDaNota(
      fornecedor({ sales: 0, revenue: 0, profit: 0, stockCost: 1500, stockUnits: 300 }),
      PARAMETROS,
      0,
      12,
    );

    expect(motivos).toHaveLength(1);
    expect(motivos[0].tipo).toBe("ruim");
    expect(motivos[0].texto).toContain("Nenhuma venda no período");
    expect(motivos[0].texto).toContain("1.500,00");
  });

  it("fornecedor sem venda e sem estoque não inventa capital parado", () => {
    const motivos = motivosDaNota(
      fornecedor({ sales: 0, revenue: 0, profit: 0, stockCost: 0, stockUnits: 0, daysWithoutSelling: 30 }),
      PARAMETROS,
      0,
      12,
    );

    expect(motivos[0].texto).toContain("nenhum estoque");
    expect(motivos[0].texto).not.toContain("R$ 0,00 parados");
  });

  it("o resultado só vira motivo nas pontas", () => {
    // Com um líder que faz 75% do lucro, "abaixo da média" seria verdade para
    // quase todo mundo e não diria nada.
    const noMeio = motivosDaNota(
      fornecedor({ scoreBreakdown: { hitRate: 60, margin: 100, turnover: 67, result: 80 } }),
      PARAMETROS,
      5,
      12,
    );
    expect(noMeio.some((m) => m.texto.includes("lucro"))).toBe(false);

    const noTopo = motivosDaNota(fornecedor(), PARAMETROS, 2, 12);
    expect(noTopo.some((m) => m.texto.includes("2º maior da loja"))).toBe(true);
  });
});

describe("corDaNota", () => {
  it("percorre a rampa e devolve cinza para quem não tem nota", () => {
    expect(corDaNota(0)).toBe(COR_SEM_NOTA);
    expect(corDaNota(100)).toBe("rgb(16,185,129)");
    // A rampa é contínua: notas diferentes não podem cair na mesma cor.
    expect(corDaNota(20)).not.toBe(corDaNota(70));
  });

  it("o rótulo é o canal que não depende de enxergar cor", () => {
    expect(rotuloDaNota(0)).toBe("Sem venda");
    expect(rotuloDaNota(85)).toBe("Excelente");
    expect(rotuloDaNota(70)).toBe("Bom");
    expect(rotuloDaNota(55)).toBe("Regular");
    expect(rotuloDaNota(40)).toBe("Atenção");
    expect(rotuloDaNota(20)).toBe("Crítico");
  });
});
