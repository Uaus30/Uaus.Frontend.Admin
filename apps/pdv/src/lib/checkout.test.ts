import { describe, expect, it } from "vitest";
import { computeCashSettlement, parseAmount } from "./checkout";

describe("parseAmount", () => {
  it("lê o formato pt-BR com separador de milhar", () => {
    expect(parseAmount("1.234,50")).toBe(1234.5);
  });

  it("lê valor simples com vírgula", () => {
    expect(parseAmount("11,50")).toBe(11.5);
  });

  it("devolve NaN para texto sem número", () => {
    expect(parseAmount("abc")).toBeNaN();
  });
});

describe("computeCashSettlement", () => {
  it("aponta a falta quando o recebido não cobre a parte em dinheiro", () => {
    // Regressão: uma venda de R$ 11,50 foi finalizada informando R$ 10,00
    // recebidos. O troco era limitado a zero e a falta passava em branco.
    const settlement = computeCashSettlement(11.5, "10,00");

    expect(settlement).toEqual({ received: 10, change: 0, shortfall: 1.5 });
  });

  it("calcula o troco quando o recebido passa do valor", () => {
    expect(computeCashSettlement(11.5, "20,00")).toEqual({
      received: 20,
      change: 8.5,
      shortfall: 0,
    });
  });

  it("não aponta falta nem troco no valor exato", () => {
    expect(computeCashSettlement(11.5, "11,50")).toEqual({
      received: 11.5,
      change: 0,
      shortfall: 0,
    });
  });

  it("trata campo vazio como valor exato recebido", () => {
    // Deixar em branco é o atalho do balcão para "recebi exatamente"; bloquear
    // aí só criaria digitação obrigatória sem ganho.
    expect(computeCashSettlement(11.5, "")).toEqual({ received: null, change: 0, shortfall: 0 });
    expect(computeCashSettlement(11.5, "   ")).toEqual({ received: null, change: 0, shortfall: 0 });
  });

  it("trata texto ilegível como campo não preenchido", () => {
    // Sem isso, o NaN vazava para o cupom no lugar do valor recebido.
    expect(computeCashSettlement(11.5, "abc")).toEqual({
      received: null,
      change: 0,
      shortfall: 0,
    });
  });

  it("ignora o recebido quando a venda não tem parcela em dinheiro", () => {
    expect(computeCashSettlement(null, "50,00")).toEqual({
      received: null,
      change: 0,
      shortfall: 0,
    });
  });

  it("não deixa erro de ponto flutuante virar falta de centavo", () => {
    // 0.1 + 0.2 e afins: sem arredondar, a diferença sairia negativa por 1e-16 e
    // o PDV acusaria falta numa venda paga exatamente.
    expect(computeCashSettlement(0.3, "0,30").shortfall).toBe(0);
    expect(computeCashSettlement(29.7, "29,70").shortfall).toBe(0);
  });

  it("aponta falta de centavo de verdade", () => {
    expect(computeCashSettlement(11.5, "11,49").shortfall).toBe(0.01);
  });
});
