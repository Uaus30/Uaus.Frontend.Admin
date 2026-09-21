import type { DimensionChangeDto, PeriodComparisonReportDto } from "@workspace/api-client-react";

/**
 * Fixtures compartilhadas pelos testes de componente desta feature.
 *
 * Os números são os de junho contra agosto de 2026, medidos em produção — e a
 * ponte vem com as CINCO parcelas, como o backend sempre manda.
 */
export function linhaDeTeste(overrides: Partial<DimensionChangeDto>): DimensionChangeDto {
  return {
    id: 1,
    name: "Utilidades",
    previousRevenue: 100,
    currentRevenue: 80,
    revenueDelta: -20,
    revenueDeltaPercentage: -20,
    previousProfit: 40,
    currentProfit: 30,
    profitDelta: -10,
    previousUnits: 10,
    currentUnits: 8,
    previousAveragePrice: 10,
    currentAveragePrice: 10,
    previousShare: 50,
    currentShare: 40,
    shareOfMovement: 100,
    status: "Shrank",
    isBucket: false,
    ...overrides,
  };
}

export const RELATORIO_DE_TESTE: PeriodComparisonReportDto = {
  previous: {
    startDate: "2026-06-01T00:00:00",
    endDate: "2026-06-30T00:00:00",
    days: 30,
    openDays: 25,
    revenue: 10243.99,
    itemRevenue: 10243.99,
    unattributedRevenue: 0,
    profit: 4072,
    marginPercentage: 39.8,
    sales: 339,
    units: 1038,
    averageTicket: 30.22,
    salesPerDay: 13.56,
    unitsPerSale: 3.06,
    revenuePerUnit: 9.87,
  },
  current: {
    startDate: "2026-08-01T00:00:00",
    endDate: "2026-08-31T00:00:00",
    days: 31,
    openDays: 26,
    revenue: 7421.3,
    itemRevenue: 7421.3,
    unattributedRevenue: 0,
    profit: 3058,
    marginPercentage: 41.2,
    sales: 332,
    units: 1238,
    averageTicket: 22.35,
    salesPerDay: 12.77,
    unitsPerSale: 3.73,
    revenuePerUnit: 5.99,
  },
  dimension: "Category",
  bridge: [
    {
      factor: "OpenDays",
      previousValue: 25,
      currentValue: 26,
      changePercentage: 4,
      amount: 352.23,
      shareOfMovement: 4.97,
    },
    {
      factor: "SalesPerDay",
      previousValue: 13.56,
      currentValue: 12.77,
      changePercentage: -5.83,
      amount: -538.21,
      shareOfMovement: 7.6,
    },
    {
      factor: "UnitsPerSale",
      previousValue: 3.06,
      currentValue: 3.73,
      changePercentage: 21.78,
      amount: 1777.08,
      shareOfMovement: 25.1,
    },
    {
      factor: "RevenuePerUnit",
      previousValue: 9.87,
      currentValue: 5.99,
      changePercentage: -39.26,
      amount: -4413.79,
      shareOfMovement: 62.33,
    },
    {
      factor: "Unattributed",
      previousValue: 0,
      currentValue: 0,
      changePercentage: null,
      amount: 0,
      shareOfMovement: 0,
    },
  ],
  changes: [linhaDeTeste({})],
  mixPrice: {
    measuredBy: "Category",
    previousRevenuePerUnit: 9.87,
    currentRevenuePerUnit: 5.99,
    change: -3.88,
    mixEffect: -2.06,
    priceEffect: -1.82,
    mixAmount: -2550.28,
    priceAmount: -2253.16,
    contributions: [],
  },
  eventItems: [],
};
