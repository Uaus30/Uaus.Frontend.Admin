import { describe, expect, it } from "vitest";
import { PURCHASE_STATUS, type PurchaseBudgetDto } from "@workspace/api-client-react";
import { purchaseBandImpact, purchaseMoneyDelta, purchaseMoneyValue } from "../purchase-band-impact";

/** Novembro/2026 no dia 23 (seção 1.1): K = 2.782, linha verde 3.220, vermelha 4.493. */
function november(overrides: Partial<PurchaseBudgetDto> = {}): PurchaseBudgetDto {
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
    greenRoom: 438,
    redRoom: 1711,
    band: "Green",
    bandIfPlannedBought: "Green",
    reliesOnBalance: false,
    stockValueAtCost: 34400,
    stockDays: 195,
    ...overrides,
  };
}

describe("purchaseMoneyValue", () => {
  it("Pendente não é dinheiro que saiu; A caminho e Lançado contam pelo final, ou pelo bruto", () => {
    expect(purchaseMoneyValue(PURCHASE_STATUS.Pending, 100, 90)).toBe(0);
    expect(purchaseMoneyValue(PURCHASE_STATUS.InTransit, 100, 90)).toBe(90);
    expect(purchaseMoneyValue(PURCHASE_STATUS.Received, 100, 0)).toBe(100);
  });
});

describe("purchaseMoneyDelta", () => {
  it("soma só a diferença no mesmo mês, e a compra inteira quando ela troca de mês", () => {
    expect(purchaseMoneyDelta(null, { monthKey: "2026-11", value: 500 })).toBe(500);
    expect(purchaseMoneyDelta({ monthKey: "2026-11", value: 500 }, { monthKey: "2026-11", value: 650 })).toBe(
      150,
    );
    expect(purchaseMoneyDelta({ monthKey: "2026-10", value: 500 }, { monthKey: "2026-11", value: 500 })).toBe(
      500,
    );
  });
});

describe("purchaseBandImpact", () => {
  it("compra nova A caminho: mantém no verde, leva ao amarelo, leva ao vermelho", () => {
    const green = purchaseBandImpact(november(), null, { monthKey: "2026-11", value: 100 });
    expect(green).toMatchObject({ before: "green", after: "green", greenRoomAfter: 338, leadsToRed: false });

    const yellow = purchaseBandImpact(november(), null, { monthKey: "2026-11", value: 900 });
    expect(yellow).toMatchObject({ after: "yellow", redRoomAfter: 811, leadsToRed: false });

    const red = purchaseBandImpact(november(), null, { monthKey: "2026-11", value: 2000 });
    expect(red).toMatchObject({ after: "red", leadsToRed: true });
  });

  it("igual à linha verde é verde; igual à vermelha é amarelo", () => {
    expect(purchaseBandImpact(november(), null, { monthKey: "2026-11", value: 438 })?.after).toBe("green");
    expect(purchaseBandImpact(november(), null, { monthKey: "2026-11", value: 1711 })?.after).toBe("yellow");
  });

  it("Pendente (valor zero) não tem linha", () => {
    expect(purchaseBandImpact(november(), null, { monthKey: "2026-11", value: 0 })).toBeNull();
  });

  it("compra que já contava, sem mudança de valor, não tem linha; mudando, soma só a diferença", () => {
    const original = { monthKey: "2026-11", value: 500 };

    expect(purchaseBandImpact(november(), original, { monthKey: "2026-11", value: 500 })).toBeNull();
    expect(purchaseBandImpact(november(), original, { monthKey: "2026-11", value: 2300 })).toMatchObject({
      after: "red",
      leadsToRed: true,
    });
  });

  it("reduzir o valor de uma compra no vermelho não pergunta nada", () => {
    const vermelho = november({ purchasesPaid: 5000 });

    const impact = purchaseBandImpact(
      vermelho,
      { monthKey: "2026-11", value: 600 },
      { monthKey: "2026-11", value: 500 },
    );
    expect(impact).toMatchObject({ before: "red", after: "red", leadsToRed: false });
  });

  it("mês fechado avisa, mas não pergunta — a compra não muda o fechamento", () => {
    const impact = purchaseBandImpact(november({ month: "2026-10", isClosedMonth: true }), null, {
      monthKey: "2026-10",
      value: 5000,
    });

    expect(impact).toMatchObject({ closedMonth: true, after: "red", leadsToRed: false });
  });

  it("sem a faixa do mês (carregando, ou ainda a de outro mês), não há linha nem pergunta", () => {
    expect(purchaseBandImpact(undefined, null, { monthKey: "2026-11", value: 2000 })).toBeNull();
    expect(purchaseBandImpact(november(), null, { monthKey: "2026-12", value: 2000 })).toBeNull();
  });
});
