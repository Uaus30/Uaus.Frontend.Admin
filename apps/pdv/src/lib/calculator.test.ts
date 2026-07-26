import { describe, expect, it } from "vitest";
import { evaluate, formatResult, isOperator, resultToExpression, tokenize } from "./calculator";

describe("tokenize", () => {
  it("separa números e operadores", () => {
    expect(tokenize("12+3×4")).toEqual(["12", "+", "3", "×", "4"]);
  });

  it("trata o menos inicial como sinal do número", () => {
    expect(tokenize("−5+2")).toEqual(["-5", "+", "2"]);
  });

  it("trata o menos depois de um operador como sinal do número", () => {
    expect(tokenize("3×−2")).toEqual(["3", "×", "-2"]);
  });

  it("mantém a vírgula decimal no número", () => {
    expect(tokenize("1,5×2")).toEqual(["1,5", "×", "2"]);
  });
});

describe("evaluate", () => {
  it("soma e subtrai da esquerda para a direita", () => {
    expect(evaluate("10+5−3")).toBe(12);
  });

  it("resolve multiplicação e divisão antes de soma e subtração", () => {
    expect(evaluate("2+9×3")).toBe(29);
    expect(evaluate("10−8÷4")).toBe(8);
  });

  it("aceita decimais com vírgula", () => {
    expect(evaluate("1,5×2")).toBe(3);
  });

  it("aceita número negativo", () => {
    expect(evaluate("−5+2")).toBe(-3);
  });

  it("ignora o operador solto no fim, para a prévia continuar valendo", () => {
    expect(evaluate("2+9×")).toBe(11);
  });

  it("recusa divisão por zero", () => {
    expect(evaluate("5÷0")).toBeNull();
  });

  it("é nulo com a expressão vazia", () => {
    expect(evaluate("")).toBeNull();
    expect(evaluate("+")).toBeNull();
  });

  it("devolve o próprio número quando não há operação", () => {
    expect(evaluate("42")).toBe(42);
  });
});

describe("formatResult", () => {
  it("formata no padrão brasileiro", () => {
    expect(formatResult(1234.5)).toBe("1.234,5");
  });

  it("corta o resíduo de ponto flutuante", () => {
    expect(formatResult(0.1 + 0.2)).toBe("0,3");
  });
});

describe("resultToExpression", () => {
  it("devolve o resultado pronto para continuar sendo editado", () => {
    expect(resultToExpression(2.5)).toBe("2,5");
    expect(resultToExpression(-3)).toBe("−3");
  });
});

describe("isOperator", () => {
  it("reconhece os quatro operadores da calculadora", () => {
    expect(["+", "−", "×", "÷"].every(isOperator)).toBe(true);
    expect(isOperator("5")).toBe(false);
    expect(isOperator("-")).toBe(false);
  });
});
