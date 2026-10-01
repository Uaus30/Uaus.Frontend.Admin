import { describe, expect, it } from "vitest";
import {
  cardSlots,
  describeLoyaltyReward,
  describeLoyaltyStamp,
  formatLoyaltyPrize,
  ordinal,
  stampProgress,
  stampsToNextReward,
} from "./loyalty";

describe("stampProgress", () => {
  it("diz quanto falta para o carimbo", () => {
    expect(stampProgress(6.5, 10)).toEqual({ earnsStamp: false, missing: 3.5 });
  });

  it("no mínimo exato já ganha o carimbo", () => {
    expect(stampProgress(10, 10)).toEqual({ earnsStamp: true, missing: 0 });
  });

  it("não sofre com o ponto flutuante dos centavos", () => {
    expect(stampProgress(9.9, 10).missing).toBe(0.1);
  });

  it("carrinho vazio não ganha carimbo, mesmo com mínimo zero", () => {
    expect(stampProgress(0, 0).earnsStamp).toBe(false);
  });
});

describe("cardSlots", () => {
  const filledNumbers = (slots: ReturnType<typeof cardSlots>) =>
    slots.filter((s) => s.filled).map((s) => s.number);

  it("com 8 carimbos num cartão de 10, mostra o trecho 6 a 10 com três cheias", () => {
    const slots = cardSlots(8, 10, 5);

    expect(slots.map((s) => s.number)).toEqual([6, 7, 8, 9, 10]);
    expect(filledNumbers(slots)).toEqual([6, 7, 8]);
    expect(slots.at(-1)?.prize).toBe(true);
  });

  it("no 5º carimbo, mostra o primeiro trecho cheio: é a hora do prêmio", () => {
    expect(filledNumbers(cardSlots(5, 10, 5))).toEqual([1, 2, 3, 4, 5]);
  });

  it("cartão novo com o carimbo extra mostra a primeira casa cheia", () => {
    expect(filledNumbers(cardSlots(1, 10, 5))).toEqual([1]);
  });

  it("sem prêmio do meio, mostra o cartão inteiro", () => {
    expect(cardSlots(3, 6, null).map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("stampsToNextReward e ordinal", () => {
  it("conta o que falta e escreve como no papel", () => {
    expect(stampsToNextReward(8, 10)).toBe(2);
    expect(stampsToNextReward(5, 5)).toBe(0);
    expect(ordinal(8)).toBe("8º");
  });
});

describe("formatLoyaltyPrize", () => {
  it("escreve valor em reais e porcentagem com vírgula", () => {
    expect(formatLoyaltyPrize(false, 5)).toMatch(/R\$\s5,00/);
    expect(formatLoyaltyPrize(true, 7.5)).toBe("7,5%");
  });
});

describe("describeLoyaltyReward", () => {
  const reward = {
    final: false,
    percentage: false,
    discountValue: 5,
    redeemedAt: null,
    expired: false,
    redeemUntil: "2027-12-03T23:59:59",
  };

  it("conta se foi trocado, se venceu ou até quando vale", () => {
    expect(describeLoyaltyReward({ ...reward, redeemedAt: "2026-12-21T10:00:00" }, 5, 10)).toMatch(
      /^Prêmio do 5º carimbo \(R\$\s5,00\): trocado em 21\/12\/2026$/,
    );
    expect(describeLoyaltyReward({ ...reward, expired: true }, 5, 10)).toContain("venceu em 03/12/2027");
    expect(describeLoyaltyReward({ ...reward, final: true }, 5, 10)).toMatch(
      /^Prêmio do 10º carimbo.*disponível até 03\/12\/2027$/,
    );
  });

  it("trocado vence o vencido: o prêmio usado não aparece como perdido", () => {
    expect(
      describeLoyaltyReward({ ...reward, redeemedAt: "2026-12-21T10:00:00", expired: true }, 5, 10),
    ).toContain("trocado em");
  });

  it("sem a posição do prêmio, não inventa o número do carimbo", () => {
    expect(describeLoyaltyReward(reward, null, 10)).toMatch(/^Prêmio \(R\$/);
  });
});

describe("describeLoyaltyStamp", () => {
  it("a linha de um carimbo mostra o número do papel", () => {
    expect(describeLoyaltyStamp({ position: 4 })).toBe("4º");
    expect(describeLoyaltyStamp({ position: 1, points: 1, bonus: true })).toBe("1º (extra)");
  });

  it("a linha de vários carimbos mostra todos, para nenhum sumir do papel", () => {
    expect(describeLoyaltyStamp({ position: 8, points: 3, adjustment: true })).toBe("6º a 8º (ajuste)");
    expect(describeLoyaltyStamp({ position: 2, points: 2, bonus: true })).toBe("1º e 2º (extra)");
  });

  it("o ajuste que tira não parece carimbo dado", () => {
    expect(describeLoyaltyStamp({ position: 4, points: -1, adjustment: true })).toBe(
      "Tirou 1 (ajuste, fica com 4)",
    );
    expect(describeLoyaltyStamp({ position: 0, points: -3, adjustment: true })).toBe(
      "Tirou 3 (ajuste, fica com 0)",
    );
  });
});
