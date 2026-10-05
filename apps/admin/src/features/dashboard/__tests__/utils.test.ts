import { describe, it, expect } from "vitest";
import {
  compactCurrency,
  formatAxisDate,
  formatBrazilianDate,
  formatClock,
  formatSignedPercent,
  DASHBOARD_PRESETS,
  growth,
  PERIOD_PRESETS,
  resolveComparison,
  resolveCustom,
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
      label: "Hoje",
    });
  });

  it("resolve o mês corrente do dia 1 até hoje", () => {
    expect(resolvePreset("month", today)).toEqual({
      startDate: "2026-07-01",
      endDate: "2026-07-25",
      label: "Julho/2026",
    });
  });

  it("resolve o mês passado inteiro, atravessando o ano", () => {
    expect(resolvePreset("lastMonth", new Date(2026, 0, 10))).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
      label: "Dezembro/2025",
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
    expect(resolvePreset("7d", lateNight).endDate).toBe("2026-07-25");
  });
});

describe("catálogos de presets", () => {
  it("mantém as telas de BI como eram, com Hoje e sem os meses", () => {
    // A Curva ABC e os Desempenhos usam este catálogo; a troca para "Este mês"
    // foi pedida só para a visão geral.
    expect(Object.keys(PERIOD_PRESETS)).toEqual(["today", "7d", "30d", "90d", "1y"]);
  });

  it("abre a visão geral com os meses e sem Hoje", () => {
    expect(Object.keys(DASHBOARD_PRESETS)).toEqual(["month", "lastMonth", "7d", "30d", "90d", "1y"]);
  });
});

describe("resolveComparison", () => {
  it("compara o mês em curso com os mesmos dias da semana quatro semanas antes", () => {
    // 1 a 3/10/2026 é quinta a sábado; 3 a 5/09 também. O "mesmo dia do mês"
    // (1 a 3/09, terça a quinta) inflava a alta de +21% para +72%.
    const period = resolvePreset("month", new Date(2026, 9, 3));
    expect(resolveComparison("month", period)).toMatchObject({
      startDate: "2026-09-03",
      endDate: "2026-09-05",
      label: "vs 4 semanas antes",
    });
  });

  it("recua cinco semanas quando o mês passou de 28 dias, sem sobrepor as janelas", () => {
    const period = resolvePreset("month", new Date(2026, 9, 30));
    const comparison = resolveComparison("month", period);
    expect(comparison).toMatchObject({ startDate: "2026-08-27", endDate: "2026-09-25" });
    expect(comparison.endDate < period.startDate).toBe(true);
  });

  it("explica as datas e o motivo na dica", () => {
    const period = resolvePreset("month", new Date(2026, 9, 3));
    expect(resolveComparison("month", period).description).toContain("03/09 a 05/09");
  });

  it("compara o mês passado com o mês anterior inteiro", () => {
    const period = resolvePreset("lastMonth", new Date(2026, 9, 3));
    expect(resolveComparison("lastMonth", period)).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      label: "vs agosto",
    });
  });

  it("compara janela móvel e intervalo livre com o período imediatamente anterior", () => {
    expect(resolveComparison("7d", resolvePreset("7d", new Date(2026, 6, 25)))).toMatchObject({
      startDate: "2026-07-12",
      endDate: "2026-07-18",
      label: "vs período anterior",
    });
    expect(resolveComparison(null, resolveCustom("2026-07-01", "2026-07-31"))).toMatchObject({
      startDate: "2026-05-31",
      endDate: "2026-06-30",
    });
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
