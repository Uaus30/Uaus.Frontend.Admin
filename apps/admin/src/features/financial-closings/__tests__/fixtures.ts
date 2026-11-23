import type { FinancialClosingDto, FinancialClosingPreviewDto } from "@workspace/api-client-react";

/**
 * Fixtures dos testes do fechamento, no formato que o servidor devolve.
 *
 * Outubro/2026 refeito no fluxo novo (seção 1 do plano, arredondado): vendas de
 * R$ 12.204, compras pagas de R$ 7.612, fixos de R$ 865 — caixa do mês de
 * R$ 3.727.
 */
export const previewFixture: FinancialClosingPreviewDto = {
  periodStart: "2026-10-01T00:00:00",
  periodEnd: "2026-10-31T00:00:00",
  revenue: 12204,
  discounts: 214,
  cogsCost: 7309,
  grossProfit: 4895,
  purchasesTotal: 7683,
  writeOffLossesTotal: 175,
  fixedCostsTotal: 865,
  variableCostsTotal: 0,
  netProfit: 4099,
  salesCount: 412,
  shares: [
    { partnerId: 1, partnerName: "Ana", percentage: 50, amount: 2049.5, withdrawnAmount: 0 },
    { partnerId: 2, partnerName: "Bruno", percentage: 50, amount: 2049.5, withdrawnAmount: 0 },
  ],
  fixedCosts: { total: 865, items: [] },
  variableCosts: [],
  warnings: [],
  calculationVersion: 2,
  grossSales: 12654,
  discountsTotal: 450,
  itemDiscountsTotal: 236,
  promotionDiscountsTotal: 181,
  couponDiscountsTotal: 0,
  stockSurplusTotal: 244,
  purchasesPaidTotal: 7612,
  contributionsTotal: 0,
  withdrawalsTotal: 0,
  monthCash: 3727,
  openingBalance: 0,
  calculatedBalance: 3727,
  isImplantation: false,
  writeOffsByReason: [{ reason: "Loss", reasonName: "Perda", totalCost: 175, totalQuantity: 9 }],
};

/** Fechamento confirmado de setembro/2026, o último. */
export const closingFixture: FinancialClosingDto = {
  ...previewFixture,
  id: 5,
  createdAt: "2026-10-02T09:00:00",
  periodStart: "2026-09-01T00:00:00",
  periodEnd: "2026-09-30T00:00:00",
  notes: null,
  closedByUserId: 1,
  closedByUserName: "Wagner",
  closingBalance: 3700,
  balanceDifference: -27,
  balanceNotes: "Taxa da maquininha",
  purchaseBand: "Yellow",
  isLatest: true,
};

/** Fechamento antigo (agosto/2026, conta antiga): sem os campos novos. */
export const legacyClosingFixture: FinancialClosingDto = {
  ...closingFixture,
  id: 3,
  periodStart: "2026-08-01T00:00:00",
  periodEnd: "2026-08-31T00:00:00",
  calculationVersion: 1,
  grossSales: 0,
  discountsTotal: 0,
  itemDiscountsTotal: 0,
  promotionDiscountsTotal: 0,
  couponDiscountsTotal: 0,
  stockSurplusTotal: 0,
  purchasesPaidTotal: 0,
  contributionsTotal: 0,
  withdrawalsTotal: 0,
  monthCash: 0,
  openingBalance: undefined,
  calculatedBalance: undefined,
  closingBalance: undefined,
  balanceDifference: undefined,
  balanceNotes: undefined,
  purchaseBand: undefined,
  isLatest: false,
};
