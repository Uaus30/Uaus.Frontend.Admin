import { describe, it, expect } from "vitest";
import {
  buildHeatGrid,
  heatPosition,
  indexDays,
  NORMAL_DAY_POSITION,
  resolveReferenceRevenue,
  weekdaySignal,
} from "../heatmap";
import type { DailyReference, MonthSummary } from "../types";

/** Mês com faturamento por dia; dias depois de `lastHappened` ainda não aconteceram. */
function month(
  year: number,
  monthNumber: number,
  revenues: Record<number, number>,
  lastHappened?: number,
): MonthSummary {
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const mm = String(monthNumber).padStart(2, "0");
  return {
    year,
    month: monthNumber,
    label: `${monthNumber}/${year}`,
    startDate: `${year}-${mm}-01T00:00:00`,
    endDate: `${year}-${mm}-${daysInMonth}T00:00:00`,
    daysElapsed: lastHappened ?? daysInMonth,
    daysInMonth,
    isCurrentMonth: lastHappened !== undefined,
    revenue: 0,
    profit: 0,
    discount: 0,
    salesCount: 0,
    itemsCount: 0,
    averageTicket: 0,
    marginPercentage: 0,
    dailyAverageRevenue: 0,
    days: Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const revenue = revenues[day] ?? 0;
      return {
        day,
        revenue,
        profit: revenue / 2,
        accumulatedRevenue: 0,
        accumulatedProfit: 0,
        salesCount: revenue > 0 ? 1 : 0,
        hasHappened: lastHappened === undefined || day <= lastHappened,
      };
    }),
  };
}

function reference(averageRevenue: number, saturdayAverage = 0): DailyReference {
  return {
    startDate: "2026-07-01T00:00:00",
    endDate: "2026-09-30T00:00:00",
    daysWithSales: 70,
    averageRevenue,
    weekdays: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      daysWithSales: dayOfWeek === 0 ? 0 : 12,
      averageRevenue: dayOfWeek === 6 ? saturdayAverage : averageRevenue,
    })),
  };
}

describe("heatPosition", () => {
  it("cai exatamente nos pontos da escala", () => {
    // Régua de R$ 300: meio dia normal é o tom 1, o dia normal é o meio da escala.
    expect(heatPosition(150, 300)).toBe(1);
    expect(heatPosition(300, 300)).toBeCloseTo(NORMAL_DAY_POSITION, 9);
    expect(heatPosition(600, 300)).toBe(5);
  });

  it("dá um tom diferente a cada valor, inclusive entre dias fracos", () => {
    // Com faixas fixas, R$ 15, 25 e 42 saíam do mesmo tom (pedido do dono, 04/10/2026).
    const [quinze, vinteCinco, quarentaDois] = [15, 25, 42].map((value) => heatPosition(value, 293) ?? 0);
    expect(quinze).toBeLessThan(vinteCinco);
    expect(vinteCinco).toBeLessThan(quarentaDois);
    // E entre dias fortes: R$ 445 e R$ 859 também se separam.
    expect(heatPosition(445, 300)).toBeLessThan(heatPosition(859, 300) ?? 0);
  });

  it("satura em 2x o dia normal", () => {
    expect(heatPosition(5000, 300)).toBe(5);
  });

  it("deixa dia sem venda fora da escala", () => {
    expect(heatPosition(0, 300)).toBeNull();
  });

  it("sem régua, usa o meio da escala", () => {
    expect(heatPosition(120, 0)).toBe(NORMAL_DAY_POSITION);
  });
});

describe("weekdaySignal", () => {
  it("marca o dia bem acima ou bem abaixo do seu dia da semana", () => {
    expect(weekdaySignal(860, 496, 13)).toBe("above");
    expect(weekdaySignal(313, 496, 13)).toBe("below");
    expect(weekdaySignal(500, 496, 13)).toBeNull();
  });

  it("não marca dia sem venda, que quase sempre é loja fechada", () => {
    expect(weekdaySignal(0, 240, 13)).toBeNull();
  });

  it("não confia em média de amostra pequena", () => {
    expect(weekdaySignal(900, 200, 2)).toBeNull();
  });
});

describe("resolveReferenceRevenue", () => {
  it("prefere a média dos três meses fechados", () => {
    expect(resolveReferenceRevenue(reference(300), [month(2026, 10, { 1: 1000 }, 4)])).toBe(300);
  });

  it("sem histórico, usa a média dos dias com venda exibidos", () => {
    const current = month(2026, 10, { 1: 100, 2: 300 }, 4);
    expect(resolveReferenceRevenue(reference(0), [current])).toBe(200);
  });
});

describe("buildHeatGrid", () => {
  // Outubro/2026: dia 1 é quinta. Setembro fornece a semana de comparação.
  const september = month(2026, 9, { 24: 0, 25: 313, 26: 380, 28: 347, 29: 258, 30: 311 });
  const october = month(2026, 10, { 1: 181, 2: 445, 3: 859 }, 4);
  const lookup = indexDays([september, october]);

  it("monta semanas de segunda a sábado e omite o domingo fechado", () => {
    const grid = buildHeatGrid(october, lookup, reference(300, 496), 300, "2026-10-04");

    expect(grid.columns).toEqual([1, 2, 3, 4, 5, 6]);
    // Dia 1 é quinta: a primeira linha começa com três casas vazias.
    expect(grid.weeks[0].cells.map((cell) => cell?.day ?? null)).toEqual([null, null, null, 1, 2, 3]);
    expect(grid.weeks[1].cells[0]?.day).toBe(5);
  });

  it("inclui a coluna de domingo quando o mês vendeu num domingo", () => {
    const grid = buildHeatGrid(month(2026, 10, { 4: 120 }, 4), lookup, reference(300), 300, "2026-10-04");
    expect(grid.columns).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("compara a semana com os mesmos dias da semana anterior", () => {
    const grid = buildHeatGrid(october, lookup, reference(300, 496), 300, "2026-10-04");

    // Qui a sáb de outubro (1.485) contra qui a sáb de setembro (24 a 26: 693).
    expect(grid.weeks[0].total).toBe(1485);
    expect(grid.weeks[0].previousTotal).toBe(693);
    expect(grid.weeks[0].growth).toBeCloseTo(114.3, 1);
  });

  it("deixa o parcial de hoje fora da variação da semana", () => {
    // Hoje é sábado, 03/10: a semana compara só qui e sex (626) com qui e sex da
    // anterior (313); o total exibido ainda soma o sábado em andamento.
    const grid = buildHeatGrid(october, lookup, reference(300, 496), 300, "2026-10-03");
    expect(grid.weeks[0].total).toBe(1485);
    expect(grid.weeks[0].comparableTotal).toBe(626);
    expect(grid.weeks[0].previousTotal).toBe(313);
    expect(grid.weeks[0].growth).toBe(100);
  });

  it("semana em que só hoje aconteceu ainda não tem variação", () => {
    // Segunda às dez da manhã: comparar o parcial com a segunda cheia anterior
    // mostraria uma queda de quase 90% que é só o relógio.
    const grid = buildHeatGrid(month(2026, 10, { 5: 40 }, 5), lookup, reference(300), 300, "2026-10-05");
    expect(grid.weeks[1].total).toBe(40);
    expect(grid.weeks[1].growth).toBeNull();
  });

  it("não abre linha vazia quando o mês começa num domingo sem coluna", () => {
    // Novembro/2026 começa num domingo, e a loja não abre domingo.
    const november = month(2026, 11, { 2: 200 });
    const grid = buildHeatGrid(november, indexDays([november]), reference(300), 300, "2026-12-15");
    expect(grid.weeks[0].cells[0]?.day).toBe(2);
    expect(grid.weeks.every((week) => week.cells.some((cell) => cell !== null))).toBe(true);
  });

  it("não compara semana que ainda não começou", () => {
    const grid = buildHeatGrid(october, lookup, reference(300, 496), 300, "2026-10-04");
    expect(grid.weeks[2].growth).toBeNull();
  });

  it("sem a semana anterior nos dados, não inventa a variação", () => {
    // A primeira semana de setembro precisaria de agosto, que não foi carregado.
    const grid = buildHeatGrid(september, lookup, reference(300), 300, "2026-10-04");
    expect(grid.weeks[0].previousTotal).toBeNull();
    expect(grid.weeks[0].growth).toBeNull();
  });

  it("pinta pela régua, marca o fora do normal e poupa o dia de hoje", () => {
    const today = buildHeatGrid(october, lookup, reference(300, 496), 300, "2026-10-03");
    const saturday = today.weeks[0].cells[5];
    expect(saturday?.position).toBe(5);
    expect(saturday?.isToday).toBe(true);
    // Hoje ainda está vendendo: nada de seta sobre um parcial.
    expect(saturday?.signal).toBeNull();

    const later = buildHeatGrid(october, lookup, reference(300, 496), 300, "2026-10-04");
    expect(later.weeks[0].cells[5]?.signal).toBe("above");
  });

  it("deixa os dias futuros sem cor", () => {
    const grid = buildHeatGrid(october, lookup, reference(300), 300, "2026-10-04");
    const fifth = grid.weeks[1].cells[0];
    expect(fifth?.hasHappened).toBe(false);
    expect(fifth?.position).toBeNull();
  });
});
