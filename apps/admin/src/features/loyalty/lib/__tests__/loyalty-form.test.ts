import { describe, expect, it } from "vitest";
import type { LoyaltySettingsDto } from "@workspace/api-client-react";
import { describeRule, formToPayload, periodFor, settingsToForm } from "../loyalty-form";

const FACTORY: LoyaltySettingsDto = {
  isActive: false,
  stampsPerCard: 10,
  middleStamp: 5,
  middleDiscountType: "Amount",
  middleDiscountValue: 5,
  middleCouponId: 10,
  middleCouponCode: "FIDELIDADE5",
  finalDiscountType: "Amount",
  finalDiscountValue: 5,
  finalCouponId: 10,
  finalCouponCode: "FIDELIDADE5",
  minimumPurchaseForStamp: 10,
  rewardMinimumPurchase: null,
  bonusStampsOnNewCard: 1,
  cardValidityMonths: 12,
  rewardGraceDays: 30,
  turnOnBlockers: [],
};

describe("describeRule", () => {
  it("resume a regra numa linha, como o dono a descreve", () => {
    expect(describeRule(FACTORY)).toMatch(
      /^R\$\s5,00 no 5º e R\$\s5,00 no 10º carimbo · mínimo de R\$\s10,00 para carimbar · \+1 no cartão novo · 12 meses \+ 30 dias para trocar$/,
    );
  });
});

describe("periodFor", () => {
  const today = new Date(2026, 10, 15);

  it("todo o período vai sem datas", () => {
    expect(periodFor("all", today)).toEqual({});
  });

  it("monta os atalhos no relógio da loja", () => {
    expect(periodFor("this-month", today)).toEqual({ from: "2026-11-01", to: "2026-11-15" });
    expect(periodFor("last-month", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodFor("90-days", today)).toEqual({ from: "2026-08-18", to: "2026-11-15" });
  });
});

describe("configuração do programa no modal", () => {
  it("vai e volta sem mudar nada (centavos com vírgula)", () => {
    const form = settingsToForm({ ...FACTORY, minimumPurchaseForStamp: 9.9 });

    expect(form.minimumPurchaseForStamp).toBe("9,9");
    expect(formToPayload(form)).toEqual({
      payload: {
        stampsPerCard: 10,
        middleStamp: 5,
        middleDiscountType: 2,
        middleDiscountValue: 5,
        middleCouponId: 10,
        finalDiscountType: 2,
        finalDiscountValue: 5,
        finalCouponId: 10,
        minimumPurchaseForStamp: 9.9,
        rewardMinimumPurchase: null,
        bonusStampsOnNewCard: 1,
        cardValidityMonths: 12,
        rewardGraceDays: 30,
      },
    });
  });

  it("prêmio em percentual não passa de 100%", () => {
    const form = { ...settingsToForm(FACTORY), finalDiscountType: 1, finalDiscountValue: "120" };

    expect(formToPayload(form)).toEqual({ error: "O prêmio do cartão completo não pode passar de 100%." });
  });

  it("o prêmio do meio fica dentro do cartão", () => {
    const form = { ...settingsToForm(FACTORY), middleStamp: "10" };

    expect(formToPayload(form)).toEqual({
      error: "O prêmio do meio precisa ficar entre o 1º e o 9º carimbo.",
    });
  });

  it("sem prêmio do meio, não manda cupom do meio", () => {
    const result = formToPayload({ ...settingsToForm(FACTORY), middleStamp: "" });

    expect(result).toMatchObject({ payload: { middleStamp: null, middleCouponId: null } });
  });
});
