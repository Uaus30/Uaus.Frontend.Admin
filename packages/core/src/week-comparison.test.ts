import { describe, expect, it } from "vitest";
import { accumulateWeekComparison, type WeekComparisonDay } from "./week-comparison";

/** Dia do comparativo semanal, com o mínimo preenchido. */
function dia(overrides: Partial<WeekComparisonDay> = {}): WeekComparisonDay {
  return { weekday: 0, revenue: 0, previousRevenue: 0, isFuture: false, ...overrides };
}

describe("accumulateWeekComparison", () => {
  it("acumula as duas séries dia a dia", () => {
    const pontos = accumulateWeekComparison([
      dia({ weekday: 0, revenue: 100, previousRevenue: 80 }),
      dia({ weekday: 1, revenue: 50, previousRevenue: 70 }),
    ]);

    expect(pontos).toEqual([
      { weekday: 0, current: 100, previous: 80 },
      { weekday: 1, current: 150, previous: 150 },
    ]);
  });

  it("corta a série atual no dia que ainda não chegou, sem parar a anterior", () => {
    // O null é o que faz a linha PARAR em hoje. Zero desenharia uma queda que
    // não aconteceu — é o mesmo contrato do card mensal do painel.
    const pontos = accumulateWeekComparison([
      dia({ weekday: 0, revenue: 200, previousRevenue: 100 }),
      dia({ weekday: 1, isFuture: true, previousRevenue: 150 }),
      dia({ weekday: 2, isFuture: true, previousRevenue: 50 }),
    ]);

    expect(pontos.map((p) => p.current)).toEqual([200, null, null]);
    expect(pontos.map((p) => p.previous)).toEqual([100, 250, 300]);
  });

  it("não soma faturamento de dia futuro, mesmo que venha preenchido", () => {
    // Defensivo: o servidor manda zero nos dias futuros, mas se um dia vier
    // sujo, ele não pode contaminar o acumulado dos dias que existem.
    const pontos = accumulateWeekComparison([
      dia({ weekday: 0, revenue: 100 }),
      dia({ weekday: 1, revenue: 999, isFuture: true }),
    ]);

    expect(pontos.map((p) => p.current)).toEqual([100, null]);
  });

  it("ordena pelo dia da semana antes de somar", () => {
    // Acumular na ordem de chegada inverteria a curva se o servidor (ou um
    // cache) devolvesse os dias fora de ordem.
    const pontos = accumulateWeekComparison([
      dia({ weekday: 1, revenue: 50, previousRevenue: 70 }),
      dia({ weekday: 0, revenue: 100, previousRevenue: 80 }),
    ]);

    expect(pontos.map((p) => p.weekday)).toEqual([0, 1]);
    expect(pontos.map((p) => p.current)).toEqual([100, 150]);
  });

  it("não propaga erro de ponto flutuante nas parciais", () => {
    const pontos = accumulateWeekComparison([
      dia({ weekday: 0, revenue: 0.1, previousRevenue: 0.1 }),
      dia({ weekday: 1, revenue: 0.2, previousRevenue: 0.2 }),
    ]);

    expect(pontos[1]).toEqual({ weekday: 1, current: 0.3, previous: 0.3 });
  });

  it("devolve lista vazia sem dias", () => {
    expect(accumulateWeekComparison([])).toEqual([]);
  });
});
