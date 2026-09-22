import type { ProfitBucketDto, ProfitLeaderDto, ProfitLeadersReportDto } from "@workspace/api-client-react";

/**
 * Treze semanas, a última recortada — o formato que 90 dias produzem.
 *
 * Campo anulável é OMITIDO, nunca escrito como `null`: a API serializa com
 * `WhenWritingNull` e o campo simplesmente não vem. Mock que escreve `null`
 * testa um formato que a API não produz.
 */
export const BUCKETS_DE_TESTE: ProfitBucketDto[] = Array.from({ length: 13 }, (_, i) => {
  const inicio = new Date(Date.UTC(2026, 5, 24 + i * 7));
  const fim = new Date(Date.UTC(2026, 5, 24 + i * 7 + 6));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return {
    startDate: iso(inicio),
    endDate: iso(fim),
    label: `S${i + 1}`,
    isPartial: i === 12,
  };
});

export function liderDeTeste(overrides: Partial<ProfitLeaderDto> = {}): ProfitLeaderDto {
  return {
    rank: 1,
    productId: 10,
    productGroupId: 1,
    productName: "POTE OVAL COM TAMPA 1 LITRO",
    barcode: "7890000000010",
    categoryName: "Utilidades",
    supplierName: "Shopee",

    profit: 222.75,
    profitPerUnit: 0.81,
    revenue: 543.29,
    marginPercentage: 41,
    units: 275,
    sales: 101,

    share: 2.54,
    cumulativeShare: 2.54,

    stock: 144,
    stockCost: 288,
    coverageDays: 53.02,

    firstSaleDate: "2026-05-02T10:00:00",
    weeksWithSales: 13,
    periodWeeks: 13,

    recentProfit: 64.8,
    recentDays: 23,
    earlierProfit: 157.95,
    earlierDays: 67,
    trendPercentage: 19.5,

    archetype: "Workhorse",
    alert: "None",

    history: [10.53, 9.72, 5.67, 5.67, 8.91, 25.92, 26.73, 20.25, 19.44, 25.11, 34.83, 29.97, 0],
    ...overrides,
  };
}

export const RELATORIO_DE_TESTE: ProfitLeadersReportDto = {
  startDate: "2026-06-24",
  endDate: "2026-09-21",
  periodDays: 90,
  period: "Last90Days",
  summary: {
    profit: 8775.65,
    generatedProfit: 8776.12,
    revenue: 21400.12,
    marginPercentage: 41,
    productsWithProfit: 513,
    leaderCount: 3,
    leaderProfit: 872,
    leaderShare: 50.23,
    leaderShareOfProducts: 12.09,
    medianProfitPerUnit: 4.98,
    decliningLeaders: 25,
    decliningStockUnits: 463,
    decliningStockCost: 3051.94,
  },
  buckets: BUCKETS_DE_TESTE,
  leaders: [
    liderDeTeste({
      rank: 1,
      productId: 20,
      productName: "CAMISETA DO BRASIL",
      profit: 387.01,
      profitPerUnit: 8.23,
      units: 47,
      archetype: "Declining",
      alert: "ParkedStock",
      trendPercentage: -90.2,
      stock: 24,
      stockCost: 264,
      recentProfit: 12.46,
      earlierProfit: 374.55,
      history: [61.98, 261.92, 22.66, 8.33, 0, 11.33, 0, 0, 0, 8.33, 12.46, 0, 0],
    }),
    liderDeTeste({
      rank: 2,
      productId: 30,
      productName: "BOLA DE FUTEBOL N 5",
      profit: 262.2,
      profitPerUnit: 11.4,
      units: 23,
      archetype: "Steady",
      alert: "None",
    }),
    liderDeTeste({ rank: 3 }),
  ],
};
