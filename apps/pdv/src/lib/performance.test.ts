import { describe, expect, it } from "vitest";
import type { PerformanceHourDto } from "@workspace/api-client-react";
import { changePercentage, describePreviousDay, hourWindow, hourlyScale } from "./performance";

/** As 24 horas do dia, com faturamento só nas horas informadas. */
function horas(faturamento: Record<number, number> = {}): PerformanceHourDto[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    revenue: faturamento[hour] ?? 0,
    salesCount: faturamento[hour] ? 1 : 0,
  }));
}

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

describe("hourWindow", () => {
  it("recorta do início do expediente até a hora atual", () => {
    const janela = hourWindow(horas({ 9: 100, 11: 40 }), 14);
    expect(janela.map((h) => h.hour)).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it("começa antes das 8h quando houve venda mais cedo", () => {
    expect(hourWindow(horas({ 7: 20 }), 10)[0].hour).toBe(7);
  });

  it("vai até a última venda quando ela é depois da hora atual do relógio", () => {
    expect(hourWindow(horas({ 9: 10, 19: 30 }), 18).at(-1)?.hour).toBe(19);
  });

  it("antes de abrir, mostra ao menos a hora de abertura", () => {
    expect(hourWindow(horas(), 6).map((h) => h.hour)).toEqual([8]);
  });

  it("sem o campo na resposta (API antiga), não quebra", () => {
    expect(hourWindow(undefined, 10)).toEqual([]);
  });
});

describe("hourlyScale", () => {
  it("usa a hora de maior faturamento", () => {
    expect(hourlyScale(horas({ 9: 100, 11: 240 }))).toBe(240);
  });

  it("devolve 1 sem venda nenhuma, para não dividir por zero", () => {
    expect(hourlyScale(horas())).toBe(1);
    expect(hourlyScale([])).toBe(1);
  });
});
