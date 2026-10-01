import { describe, expect, it } from "vitest";
import { cardSlots, ordinal, stampProgress, stampsToNextReward } from "./loyalty";

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
