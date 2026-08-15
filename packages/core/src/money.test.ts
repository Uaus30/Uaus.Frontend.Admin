import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatPercentage,
  formatQuantity,
  parseAmount,
  parseAmountOrNull,
  round2,
} from "./money";

describe("round2", () => {
  // Estes quatro valores são os que faziam os três algoritmos antigos
  // divergirem. Ficam no teste como documentação viva do porquê do EPSILON:
  // sem ele, Math.round(1.005 * 100) devolve 100 e o centavo some.
  it.each([
    [1.005, 1.01],
    [1.045, 1.05],
    [1.335, 1.34],
    [2.675, 2.68],
  ])("arredonda %s para %s", (entrada, esperado) => {
    expect(round2(entrada)).toBe(esperado);
  });

  it("mantém valores que já têm duas casas", () => {
    expect(round2(10.5)).toBe(10.5);
    expect(round2(0.01)).toBe(0.01);
    expect(round2(1234.56)).toBe(1234.56);
  });

  it("corrige a soma de centavos que o ponto flutuante erra", () => {
    // 0.1 + 0.2 === 0.30000000000000004 em binário.
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.99 * 3)).toBe(59.97);
  });

  it("preserva o sinal de valores negativos", () => {
    expect(round2(-1.005)).toBe(-1);
    expect(round2(-10.567)).toBe(-10.57);
  });

  it("trata zero sem produzir -0", () => {
    expect(round2(0)).toBe(0);
    expect(Object.is(round2(0), -0)).toBe(false);
  });
});

describe("parseAmount", () => {
  it("lê o formato pt-BR com separador de milhar", () => {
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("1.234.567,89")).toBe(1234567.89);
  });

  it("lê valores sem separador de milhar", () => {
    expect(parseAmount("10,50")).toBe(10.5);
    expect(parseAmount("7")).toBe(7);
  });

  it("devolve NaN para texto ilegível", () => {
    // Comportamento intencional: quem chama decide se NaN é erro ou campo vazio.
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount("abc")).toBeNaN();
  });
});

describe("parseAmountOrNull", () => {
  it("trata campo vazio como zero", () => {
    // Regressão: os diálogos de caixa mandavam NaN para a API quando o operador
    // deixava o campo de dinheiro em branco.
    expect(parseAmountOrNull("")).toBe(0);
    expect(parseAmountOrNull("   ")).toBe(0);
  });

  it("devolve null para texto ilegível", () => {
    expect(parseAmountOrNull("abc")).toBeNull();
    expect(parseAmountOrNull("R$")).toBeNull();
  });

  it("arredonda o valor lido", () => {
    expect(parseAmountOrNull("1.234,567")).toBe(1234.57);
  });

  it("aceita zero e negativo — a validação de faixa é de quem chama", () => {
    expect(parseAmountOrNull("0")).toBe(0);
    expect(parseAmountOrNull("-5,00")).toBe(-5);
  });
});

describe("formatCurrency", () => {
  it("formata em reais no padrão pt-BR", () => {
    //   é o espaço não separável que o Intl insere depois de "R$".
    expect(formatCurrency(1234.5)).toBe("R$ 1.234,50");
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });
});

describe("formatQuantity", () => {
  it("não força casas decimais em quantidade inteira", () => {
    expect(formatQuantity(1)).toBe("1");
    expect(formatQuantity(12)).toBe("12");
  });

  it("mostra até três casas para produto vendido a peso", () => {
    expect(formatQuantity(1.5)).toBe("1,5");
    expect(formatQuantity(0.325)).toBe("0,325");
  });
});

describe("formatPercentage", () => {
  it("fixa duas casas, como a precisão do backend", () => {
    expect(formatPercentage(12.5)).toBe("12,50%");
    expect(formatPercentage(100)).toBe("100,00%");
    expect(formatPercentage(33.33)).toBe("33,33%");
  });
});
