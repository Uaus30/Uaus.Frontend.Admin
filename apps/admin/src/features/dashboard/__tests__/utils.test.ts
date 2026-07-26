import { describe, it, expect } from "vitest";
import {
  compactCurrency,
  formatAxisDate,
  formatBrazilianDate,
  formatClock,
  formatSignedPercent,
  growth,
  resolvePreset,
} from "../utils";

describe("resolvePreset", () => {
  const today = new Date(2026, 6, 25); // 25/07/2026

  it("conta o dia de hoje dentro da janela", () => {
    // Sete dias incluindo hoje começam no dia 19, não no 18.
    expect(resolvePreset("7d", today)).toMatchObject({
      startDate: "2026-07-19",
      endDate: "2026-07-25",
    });
  });

  it("resolve hoje como um único dia", () => {
    expect(resolvePreset("today", today)).toMatchObject({
      startDate: "2026-07-25",
      endDate: "2026-07-25",
    });
  });

  it("atravessa a virada de mês e de ano", () => {
    expect(resolvePreset("30d", new Date(2026, 0, 10))).toMatchObject({
      startDate: "2025-12-12",
      endDate: "2026-01-10",
    });
  });

  it("não usa UTC ao formatar a data", () => {
    // Uma data no fim do dia em fuso negativo viraria o dia seguinte via
    // toISOString(); o recorte enviado à API sairia deslocado.
    const lateNight = new Date(2026, 6, 25, 23, 30);
    expect(resolvePreset("today", lateNight).startDate).toBe("2026-07-25");
  });
});

describe("growth", () => {
  it("calcula a variação percentual", () => {
    expect(growth(150, 100)).toBe(50);
    expect(growth(50, 100)).toBe(-50);
  });

  it("devolve nulo quando não há base de comparação", () => {
    // Sair de zero para cem não é "cem por cento": não existe variação
    // percentual sobre zero, e exibir qualquer número ali seria inventar dado.
    expect(growth(100, 0)).toBeNull();
  });

  it("trata zero contra zero como estabilidade", () => {
    expect(growth(0, 0)).toBe(0);
  });

  it("usa o módulo da base para não inverter o sinal em base negativa", () => {
    // Prejuízo de 100 que vira lucro de 50 é uma melhora, não uma queda.
    expect(growth(50, -100)).toBe(150);
  });
});

describe("formatadores", () => {
  it("converte datas da API sem passar por Date", () => {
    expect(formatBrazilianDate("2026-07-25T00:00:00")).toBe("25/07/2026");
    expect(formatAxisDate("2026-07-25T00:00:00")).toBe("25/07");
  });

  it("extrai o relógio de um instante da API", () => {
    expect(formatClock("2026-07-25T17:34:12")).toBe("17:34");
  });

  it("abrevia valores grandes nos eixos", () => {
    expect(compactCurrency(950)).toBe("950");
    expect(compactCurrency(12_400)).toBe("12k");
    expect(compactCurrency(1_250_000)).toBe("1,3M");
  });

  it("marca o sinal do percentual", () => {
    expect(formatSignedPercent(12.34)).toBe("+12,3%");
    expect(formatSignedPercent(-8)).toBe("-8,0%");
  });
});
