import { describe, expect, it } from "vitest";
import {
  amountInputText,
  checkBalance,
  parseAmountField,
  sameWithdrawals,
  withdrawalsForShares,
  withdrawalsFromDrafts,
} from "../closing-balance";

describe("parseAmountField", () => {
  it("separa o vazio do ilegível — vazio não é zero", () => {
    expect(parseAmountField("  ")).toEqual({ kind: "empty" });
    expect(parseAmountField("abc")).toEqual({ kind: "invalid" });
    expect(parseAmountField("1727.5")).toEqual({ kind: "value", value: 1727.5 });
    expect(parseAmountField("10,25")).toEqual({ kind: "value", value: 10.25 });
    expect(parseAmountField("-30")).toEqual({ kind: "value", value: -30 });
  });
});

describe("retiradas", () => {
  it("lê o rascunho com vazio valendo zero, e recusa negativo ou ilegível", () => {
    expect(withdrawalsFromDrafts({ 1: "2000", 2: "" })).toEqual([
      { partnerId: 1, amount: 2000 },
      { partnerId: 2, amount: 0 },
    ]);
    expect(withdrawalsFromDrafts({ 1: "-1" })).toBeNull();
    expect(withdrawalsFromDrafts({ 1: "x" })).toBeNull();
  });

  it("compara ignorando os zeros: retirar nada é não retirar", () => {
    expect(sameWithdrawals([{ partnerId: 1, amount: 0 }], [])).toBe(true);
    expect(sameWithdrawals([{ partnerId: 1, amount: 10 }], [{ partnerId: 1, amount: 10 }])).toBe(true);
    expect(sameWithdrawals([{ partnerId: 1, amount: 10 }], [{ partnerId: 1, amount: 11 }])).toBe(false);
    expect(sameWithdrawals([{ partnerId: 1, amount: 10 }], [{ partnerId: 2, amount: 10 }])).toBe(false);
  });

  it("manda uma por sócio do rateio, com zero para quem não retirou", () => {
    expect(
      withdrawalsForShares([{ partnerId: 1 }, { partnerId: 2 }], [{ partnerId: 2, amount: 300 }]),
    ).toEqual([
      { partnerId: 1, amount: 0 },
      { partnerId: 2, amount: 300 },
    ]);
  });
});

describe("checkBalance", () => {
  it("o saldo confirmado é obrigatório", () => {
    expect(checkBalance(3727, "", "").problem).toMatch(/Informe o saldo confirmado/);
    expect(checkBalance(3727, "abc", "").problem).toMatch(/não é um valor válido/);
  });

  it("diferença de até R$ 1,00 passa sem observação; acima, exige", () => {
    expect(checkBalance(3727, "3726", "")).toMatchObject({
      difference: -1,
      notesRequired: false,
      problem: null,
    });

    const above = checkBalance(3727, "3725.99", "");
    expect(above).toMatchObject({ difference: -1.01, notesRequired: true });
    expect(above.problem).toMatch(/Explique a diferença/);

    expect(checkBalance(3727, "3800", "Venda no cartão que não caiu").problem).toBeNull();
  });

  it("sem saldo calculado (implantação sem saldo inicial) não há diferença a explicar", () => {
    expect(checkBalance(undefined, "5000", "")).toMatchObject({
      confirmed: 5000,
      difference: null,
      notesRequired: false,
      problem: null,
    });
  });

  it("saldo negativo é aceito, com aviso", () => {
    expect(checkBalance(-100, "-100", "")).toMatchObject({ negative: true, problem: null });
  });
});

describe("amountInputText", () => {
  it("escreve o número do servidor como o campo numérico espera", () => {
    expect(amountInputText(3727.5)).toBe("3727.5");
    expect(amountInputText(null)).toBe("");
    expect(amountInputText(undefined)).toBe("");
  });
});
