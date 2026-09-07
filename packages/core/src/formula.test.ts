import { describe, expect, it } from "vitest";
import { evaluateAmountFormula, isAmountFormula } from "./formula";

describe("isAmountFormula", () => {
  it("reconhece só o texto que começa com =", () => {
    expect(isAmountFormula("=17,99*2")).toBe(true);
    expect(isAmountFormula("  =2+2")).toBe(true);
    expect(isAmountFormula("17,99")).toBe(false);
    expect(isAmountFormula("")).toBe(false);
  });
});

describe("evaluateAmountFormula", () => {
  it("aceita vírgula e ponto como separador decimal", () => {
    // O caso que originou o campo: 12 unidades a 17,99 na nota do fornecedor.
    expect(evaluateAmountFormula("=17,99*2")).toBe(35.98);
    expect(evaluateAmountFormula("=17.99*2")).toBe(35.98);
    expect(evaluateAmountFormula("17,99*12")).toBe(215.88);
  });

  it("respeita a precedência e os parênteses", () => {
    expect(evaluateAmountFormula("=2+3*4")).toBe(14);
    expect(evaluateAmountFormula("=(2+3)*4")).toBe(20);
    expect(evaluateAmountFormula("=100/4")).toBe(25);
    expect(evaluateAmountFormula("=10 + 5 - 3")).toBe(12);
  });

  it("aceita sinal unário e espaços soltos", () => {
    expect(evaluateAmountFormula("= -5 + 20")).toBe(15);
    expect(evaluateAmountFormula("=-(2*3)")).toBe(-6);
  });

  it("arredonda ao centavo, como todo dinheiro do repositório", () => {
    expect(evaluateAmountFormula("=100/3")).toBe(33.33);
    expect(evaluateAmountFormula("=0,1+0,2")).toBe(0.3);
  });

  it("lê o número com ponto de milhar E vírgula decimal como pt-BR", () => {
    expect(evaluateAmountFormula("=1.234,50")).toBe(1234.5);
    expect(evaluateAmountFormula("=1.234,50*2")).toBe(2469);
  });

  it("devolve null no que não é conta — quem chama mantém o valor anterior", () => {
    expect(evaluateAmountFormula("=")).toBeNull();
    expect(evaluateAmountFormula("=2*")).toBeNull();
    expect(evaluateAmountFormula("=(2+3")).toBeNull();
    expect(evaluateAmountFormula("=2*3 abacaxi")).toBeNull();
    expect(evaluateAmountFormula("=10/0"), "Infinity no campo de total não é resposta").toBeNull();
  });

  it("não executa o que foi digitado", () => {
    // O texto vem de um campo de formulário: nada aqui pode virar código.
    expect(evaluateAmountFormula("=alert(1)")).toBeNull();
    expect(evaluateAmountFormula("=process.exit")).toBeNull();
  });
});
