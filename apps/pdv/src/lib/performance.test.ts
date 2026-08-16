import { describe, expect, it } from "vitest";
import type { WeekdayComparisonDto } from "@workspace/api-client-react";
import {
  changePercentage,
  describePreviousDay,
  weekComparisonScale,
  weekRevenueSoFar,
  weekdayLabel,
} from "./performance";

/** Dia do comparativo semanal, com o mínimo preenchido. */
function dia(overrides: Partial<WeekdayComparisonDto> = {}): WeekdayComparisonDto {
  return {
    weekday: 0,
    date: "2026-08-10T00:00:00",
    revenue: 0,
    previousRevenue: 0,
    isFuture: false,
    ...overrides,
  };
}

describe("weekdayLabel", () => {
  it("começa na segunda, como a semana do varejo", () => {
    expect(weekdayLabel(0)).toBe("Seg");
    expect(weekdayLabel(6)).toBe("Dom");
  });

  it("não quebra com índice fora da faixa", () => {
    expect(weekdayLabel(9)).toBe("?");
  });
});

describe("changePercentage", () => {
  it("calcula a alta", () => {
    expect(changePercentage(150, 100)).toBe(50);
  });

  it("calcula a queda", () => {
    expect(changePercentage(80, 100)).toBe(-20);
  });

  it("devolve null sem base de comparação", () => {
    // Nem 100% (que viraria "desempenho" no primeiro dia da loja) nem 0% (que
    // diria "ficou igual"). As duas mentem.
    expect(changePercentage(500, 0)).toBeNull();
  });

  it("devolve zero quando não variou", () => {
    expect(changePercentage(100, 100)).toBe(0);
  });

  it("arredonda para duas casas", () => {
    expect(changePercentage(100, 33)).toBe(203.03);
  });
});

describe("describePreviousDay", () => {
  const hoje = new Date(2026, 7, 17); // segunda-feira

  it("devolve null quando a loja nunca vendeu antes", () => {
    expect(describePreviousDay(100, null, hoje)).toBeNull();
  });

  it("rotula como 'ontem' quando o dia anterior foi ontem mesmo", () => {
    const anterior = { date: "2026-08-16T00:00:00", revenue: 200, salesCount: 4, averageTicket: 50 };

    const leitura = describePreviousDay(300, anterior, hoje);

    expect(leitura?.isYesterday).toBe(true);
    expect(leitura?.label).toBe("ontem");
  });

  it("mostra a DATA quando o último dia com venda não foi ontem", () => {
    // O caso que motivou tudo: numa segunda, o último dia com venda é o sábado.
    // Dizer só "dia anterior" faria o operador achar que é domingo.
    const sabado = { date: "2026-08-15T00:00:00", revenue: 400, salesCount: 8, averageTicket: 50 };

    const leitura = describePreviousDay(500, sabado, hoje);

    expect(leitura?.isYesterday).toBe(false);
    expect(leitura?.label).toBe("15/08");
  });

  it("calcula a variação sobre o dia comparado", () => {
    const anterior = { date: "2026-08-15T00:00:00", revenue: 400, salesCount: 8, averageTicket: 50 };

    expect(describePreviousDay(500, anterior, hoje)?.change).toBe(25);
  });

  it("devolve variação nula quando o dia anterior faturou zero", () => {
    const anterior = { date: "2026-08-15T00:00:00", revenue: 0, salesCount: 0, averageTicket: 0 };

    expect(describePreviousDay(500, anterior, hoje)?.change).toBeNull();
  });
});

describe("weekComparisonScale", () => {
  it("usa o maior acumulado entre as DUAS semanas", () => {
    // Escala única: escalas independentes fariam uma semana fraca parecer igual
    // a uma forte, que é o oposto do que o gráfico existe para mostrar.
    const pontos = [
      { weekday: 0, current: 100, previous: 250 },
      { weekday: 1, current: 300, previous: 260 },
    ];

    expect(weekComparisonScale(pontos)).toBe(300);
  });

  it("ignora o dia que ainda não chegou na série atual", () => {
    expect(weekComparisonScale([{ weekday: 0, current: null, previous: 40 }])).toBe(40);
  });

  it("devolve 1 na semana sem venda nenhuma, para não dividir por zero", () => {
    expect(weekComparisonScale([{ weekday: 0, current: 0, previous: 0 }])).toBe(1);
  });

  it("devolve 1 com a lista vazia", () => {
    expect(weekComparisonScale([])).toBe(1);
  });
});

describe("weekRevenueSoFar", () => {
  it("soma só os dias que já aconteceram", () => {
    const dias = [
      dia({ weekday: 0, revenue: 100 }),
      dia({ weekday: 1, revenue: 150 }),
      dia({ weekday: 2, revenue: 0, isFuture: true }),
      dia({ weekday: 3, revenue: 0, isFuture: true }),
    ];

    expect(weekRevenueSoFar(dias)).toBe(250);
  });

  it("devolve zero na segunda de manhã, sem venda ainda", () => {
    expect(weekRevenueSoFar([dia({ isFuture: false }), dia({ isFuture: true })])).toBe(0);
  });

  it("não propaga erro de ponto flutuante", () => {
    const dias = [dia({ revenue: 0.1 }), dia({ revenue: 0.2 })];

    expect(weekRevenueSoFar(dias)).toBe(0.3);
  });
});
