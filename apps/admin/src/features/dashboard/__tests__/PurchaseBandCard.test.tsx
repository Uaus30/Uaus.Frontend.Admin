import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PurchaseBudgetDto } from "@workspace/api-client-react";
import { PurchaseBandCard } from "../components/PurchaseBandCard";

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

const text = () => (screen.getByTestId("purchase-band-card").textContent ?? "").replace(/\u00a0/g, " ");

describe("PurchaseBandCard", () => {
  afterEach(() => cleanup());

  it("mostra a faixa do mês e o que ainda dá para comprar, e abre o Painel", () => {
    render(<PurchaseBandCard budget={budget()} isLoading={false} />);

    expect(text()).toContain("Compras de novembro: verde");
    expect(text()).toContain("Pode comprar R$ 439,00 no verde · R$ 1.712,00 até o vermelho");
    expect(screen.getByTestId("purchase-band-card").getAttribute("href")).toBe("/financeiro/painel");
  });

  it("no vermelho diz o aporte que volta ao verde", () => {
    render(
      <PurchaseBandCard budget={budget({ band: "Red", greenRoom: -100, redRoom: -50 })} isLoading={false} />,
    );

    expect(screen.getByTestId("purchase-band-card").dataset.band).toBe("red");
    expect(text()).toContain("Volta ao verde com R$ 100,00 de aporte");
  });

  it("some quando a consulta falhou: o erro do financeiro não toma o Dashboard", () => {
    render(<PurchaseBandCard budget={undefined} isLoading={false} />);

    expect(screen.queryByTestId("purchase-band-card")).toBeNull();
  });
});
