import { describe, expect, it } from "vitest";
import { isRewardList, rewardSituation } from "../loyalty-actions";

describe("rewardSituation", () => {
  it("conta a situação do prêmio como o balcão fala", () => {
    expect(rewardSituation({ customerId: 1, name: "Ana", rewardStatus: "Available", expired: false })).toBe(
      "Disponível",
    );
    expect(
      rewardSituation({
        customerId: 1,
        name: "Ana",
        rewardStatus: "Redeemed",
        redeemedAt: "2026-12-21T10:00:00",
      }),
    ).toBe("Trocado em 21/12/2026");
    expect(rewardSituation({ customerId: 1, name: "Ana", rewardStatus: "Cancelled" })).toBe("Cancelado");
  });

  it("o disponível fora do prazo é vencido, embora a situação gravada continue disponível", () => {
    expect(rewardSituation({ customerId: 1, name: "Ana", rewardStatus: "Available", expired: true })).toBe(
      "Vencido",
    );
  });
});

describe("isRewardList", () => {
  it("só as listas de prêmio mostram uma linha por prêmio", () => {
    expect(isRewardList("rewards-waiting")).toBe(true);
    expect(isRewardList("grace")).toBe(true);
    expect(isRewardList("inactive")).toBe(false);
    expect(isRewardList(null)).toBe(false);
  });
});
