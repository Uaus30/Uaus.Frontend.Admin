import { describe, expect, it } from "vitest";
import {
  balanceSupport,
  monthInSentence,
  plannedNotice,
  provisionalNotice,
  purchaseBandHeadline,
  purchaseBandOf,
  purchaseRooms,
} from "../purchase-band";

/** `formatCurrency` usa espaço não separável entre "R$" e o número. */
const brl = (texto: string) => texto.replace(/\u00a0/g, " ");

describe("purchaseBandOf", () => {
  it("lê o enum pelo nome, como o backend serializa, e pelo código", () => {
    expect(purchaseBandOf("Green")).toBe("green");
    expect(purchaseBandOf("Yellow")).toBe("yellow");
    expect(purchaseBandOf(3)).toBe("red");
  });

  it("devolve null quando a faixa não veio (fechamento antigo)", () => {
    expect(purchaseBandOf(undefined)).toBeNull();
    expect(purchaseBandOf("Desconhecida")).toBeNull();
  });
});

describe("balanceSupport e purchaseBandHeadline", () => {
  it("dizem de onde vem o dinheiro quando a faixa depende dele", () => {
    expect(balanceSupport({ reliesOnBalance: true, openingBalance: 1727, contributions: 0 })).toBe(
      "com saldo",
    );
    expect(balanceSupport({ reliesOnBalance: true, openingBalance: 0, contributions: 500 })).toBe(
      "com aporte",
    );
    expect(balanceSupport({ reliesOnBalance: true, openingBalance: 10, contributions: 5 })).toBe(
      "com saldo e aporte",
    );
    expect(balanceSupport({ reliesOnBalance: false, openingBalance: 1727, contributions: 0 })).toBeNull();
  });

  it("monta a frase de cada faixa", () => {
    expect(purchaseBandHeadline("green", null)).toBe("Compras dentro do custo do que foi vendido");
    expect(purchaseBandHeadline("green", "com saldo")).toBe(
      "Compras dentro do custo do que foi vendido, com saldo",
    );
    expect(purchaseBandHeadline("red", null)).toBe("Com estas compras, o mês não cobre os custos fixos");
  });
});

describe("purchaseRooms", () => {
  it("verde com amarelo pela frente: as duas folgas (novembro, seção 1.1)", () => {
    const { parts, backToGreen } = purchaseRooms("green", 439, 1712);

    expect(parts.map(brl)).toEqual(["R$ 439,00 no verde", "R$ 1.712,00 até o vermelho"]);
    expect(backToGreen).toBeNull();
  });

  it("linha vermelha abaixo da verde: passar do verde já é vermelho, e a folga do vermelho some", () => {
    expect(purchaseRooms("green", 300, 100).parts.map(brl)).toEqual(["R$ 300,00 no verde"]);
  });

  it("fora do verde: o aporte que volta ao verde", () => {
    const amarelo = purchaseRooms("yellow", -303, 3727);
    expect(amarelo.parts.map(brl)).toEqual(["R$ 3.727,00 até o vermelho"]);
    expect(brl(amarelo.backToGreen ?? "")).toBe("Volta ao verde com R$ 303,00 de aporte");

    const vermelho = purchaseRooms("red", -2701, -100);
    expect(vermelho.parts).toEqual([]);
    expect(brl(vermelho.backToGreen ?? "")).toBe("Volta ao verde com R$ 2.701,00 de aporte");
  });
});

describe("avisos", () => {
  it("a faixa provisória manda fechar o mês que falta", () => {
    expect(provisionalNotice({ month: "2026-11", pendingClosingMonth: "2026-10" })).toBe(
      "Feche outubro para começar novembro com o saldo",
    );
    expect(provisionalNotice({ month: "2026-11", pendingClosingMonth: undefined })).toBe(
      "Feche o mês anterior para começar novembro com o saldo",
    );
    expect(monthInSentence("2026-03-01T00:00:00")).toBe("março");
  });

  it("as pendentes com valor simulam a faixa; sem elas, nada", () => {
    expect(
      brl(plannedNotice({ purchasesPlanned: 600, band: "Green", bandIfPlannedBought: "Yellow" }) ?? ""),
    ).toBe("Se fizer as pendentes (R$ 600,00), o mês vai para amarelo");
    expect(
      brl(plannedNotice({ purchasesPlanned: 100, band: "Green", bandIfPlannedBought: "Green" }) ?? ""),
    ).toBe("Se fizer as pendentes (R$ 100,00), o mês continua verde");
    expect(plannedNotice({ purchasesPlanned: 0, band: "Green", bandIfPlannedBought: "Green" })).toBeNull();
  });
});
