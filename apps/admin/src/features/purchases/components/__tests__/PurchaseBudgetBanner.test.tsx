import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PurchaseBudgetDto } from "@workspace/api-client-react";
import { PurchaseBudgetBanner } from "../PurchaseBudgetBanner";

function budget(overrides: Partial<PurchaseBudgetDto> = {}): PurchaseBudgetDto {
  return {
    month: "2026-11",
    periodStart: "2026-11-01T00:00:00",
    periodEnd: "2026-11-30T00:00:00",
    isCurrentMonth: true,
    isClosedMonth: false,
    isProvisional: false,
    openingBalance: 0,
    contributions: 0,
    availableBalance: 0,
    revenue: 5358,
    costOfSales: 3220,
    purchasesPaid: 2782,
    purchasesPlanned: 0,
    plannedWithoutValueCount: 0,
    fixedCosts: 865,
    greenLimit: 3220,
    redLimit: 4493,
    greenRoom: 439,
    redRoom: 1712,
    band: "Green",
    bandIfPlannedBought: "Green",
    reliesOnBalance: false,
    stockValueAtCost: 34400,
    stockDays: 195,
    ...overrides,
  };
}

/** O texto do banner com o espaço comum no lugar do não separável do `Intl`. */
function bannerText() {
  return (screen.getByTestId("purchase-budget-banner").textContent ?? "").replace(/\u00a0/g, " ");
}

describe("PurchaseBudgetBanner", () => {
  afterEach(() => cleanup());

  it("diz a faixa do mês e o que ainda dá para comprar, com link para o Painel", () => {
    render(<PurchaseBudgetBanner budget={budget()} />);

    expect(bannerText()).toContain(
      "Novembro está verde: pode comprar R$ 439,00 no verde, R$ 1.712,00 até o vermelho",
    );
    expect(screen.getByTestId("purchase-budget-banner").getAttribute("href")).toBe("/financeiro/painel");
    expect(screen.getByTestId("purchase-budget-banner").dataset.band).toBe("green");
  });

  it("simula as pendentes com valor", () => {
    render(
      <PurchaseBudgetBanner budget={budget({ purchasesPlanned: 600, bandIfPlannedBought: "Yellow" })} />,
    );

    expect(bannerText()).toContain("Se fizer as pendentes (R$ 600,00), o mês vai para amarelo");
  });

  it("provisória diz que é, e qual mês falta fechar", () => {
    render(<PurchaseBudgetBanner budget={budget({ isProvisional: true, pendingClosingMonth: "2026-10" })} />);

    expect(bannerText()).toContain("(provisória)");
    expect(bannerText()).toContain("Feche outubro para começar novembro com o saldo");
  });

  it("fora do verde, diz o aporte que traz o mês de volta", () => {
    render(<PurchaseBudgetBanner budget={budget({ band: "Red", greenRoom: -2701, redRoom: -1500 })} />);

    expect(bannerText()).toContain("Novembro está vermelho");
    expect(bannerText()).toContain("Volta ao verde com R$ 2.701,00 de aporte");
  });

  it("não aparece enquanto a faixa não chegou", () => {
    render(<PurchaseBudgetBanner budget={undefined} />);

    expect(screen.queryByTestId("purchase-budget-banner")).toBeNull();
  });
});
