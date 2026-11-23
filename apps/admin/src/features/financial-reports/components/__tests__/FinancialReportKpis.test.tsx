import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FinancialReportSummaryDto } from "@workspace/api-client-react";
import { FinancialReportKpis } from "../FinancialReportKpis";

/** Outubro/2026 (seção 1 do plano), arredondado. */
const summary: FinancialReportSummaryDto = {
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  sales: {
    revenue: 12204,
    cost: 7309,
    profit: 4895,
    discount: 214,
    marginPercentage: 40.1,
    salesCount: 412,
    cancelledSalesCount: 0,
    itemsCount: 900,
    averageTicket: 29.62,
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  },
  purchasesTotal: 7683,
  writeOffs: { totalCost: 175, totalQuantity: 9, byReason: [] },
  fixedCosts: { total: 865, items: [] },
  grossProfit: 4895,
  grossSales: 12654,
  discountsTotal: 450,
  itemDiscountsTotal: 236,
  promotionDiscountsTotal: 181,
  couponDiscountsTotal: 0,
  stockSurplusTotal: 244,
  purchasesPaidTotal: 7612,
  contributionsTotal: 0,
  netProfit: 4099,
  partnerDistribution: [],
  warnings: [],
};

const page = () => (document.body.textContent ?? "").replace(/\u00a0/g, " ");

describe("FinancialReportKpis — a conta do fechamento no resumo", () => {
  afterEach(() => cleanup());

  it("separa as entradas de estoque das compras pagas", () => {
    render(<FinancialReportKpis summary={summary} isLoading={false} />);

    // O "Compras" antigo somava entradas: o nome agora diz o que é.
    expect(screen.getByText("Entradas de estoque")).toBeTruthy();
    expect(screen.getByText("Compras pagas")).toBeTruthy();
    expect(screen.queryByText("Compras no período")).toBeNull();
    expect(page()).toContain("R$ 7.683,00");
    expect(page()).toContain("R$ 7.612,00");
  });

  it("mostra os descontos por origem, com promoção e cupom como parcelas", () => {
    render(<FinancialReportKpis summary={summary} isLoading={false} />);

    expect(page()).toContain("No item R$ 236,00 (promoção R$ 181,00) · na venda R$ 214,00 (cupom R$ 0,00)");
  });

  it("põe baixas e sobras dentro do lucro líquido", () => {
    render(<FinancialReportKpis summary={summary} isLoading={false} />);

    expect(screen.getByText("Baixas a custo")).toBeTruthy();
    expect(screen.getByText("Sobras de estoque")).toBeTruthy();
    expect(screen.getByText("Lucro bruto − baixas + sobras − custos fixos")).toBeTruthy();
  });
});
