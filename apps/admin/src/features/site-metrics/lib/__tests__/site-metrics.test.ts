import { describe, expect, it } from "vitest";
import {
  describePath,
  formatDayLabel,
  formatDuration,
  formatFullDate,
  formatShare,
  resolveSitePeriod,
} from "../site-metrics";

describe("resolveSitePeriod", () => {
  it("conta hoje como o último dia do período", () => {
    const hoje = new Date(2026, 8, 30, 15, 0, 0);

    expect(resolveSitePeriod(7, hoje)).toEqual({ startDate: "2026-09-24", endDate: "2026-09-30" });
    expect(resolveSitePeriod(30, hoje)).toEqual({ startDate: "2026-09-01", endDate: "2026-09-30" });
  });

  it("usa a data local, não UTC", () => {
    // 23h50 no Brasil já é o dia seguinte em UTC; toISOString() erraria o dia.
    const noite = new Date(2026, 8, 30, 23, 50, 0);

    expect(resolveSitePeriod(7, noite).endDate).toBe("2026-09-30");
  });
});

describe("formatDuration", () => {
  it("lê como gente: segundos, minutos, horas", () => {
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(130_000)).toBe("2 min 10 s");
    expect(formatDuration(120_000)).toBe("2 min");
    expect(formatDuration(3_900_000)).toBe("1 h 05 min");
  });

  it("zero e valor inválido viram travessão, não '0 s'", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
  });
});

describe("formatShare", () => {
  it("arredonda e protege a divisão por zero", () => {
    expect(formatShare(1, 3)).toBe("33%");
    expect(formatShare(0, 0)).toBe("—");
    expect(formatShare(2, 2)).toBe("100%");
  });
});

describe("datas e rotas", () => {
  it("formata o dia curto e o completo", () => {
    expect(formatDayLabel("2026-09-30")).toBe("30/09");
    expect(formatFullDate("2026-09-30")).toBe("30/09/2026");
  });

  it("traduz as rotas do site e deixa o desconhecido como veio", () => {
    expect(describePath("/")).toBe("Início");
    expect(describePath("/produtos/:id")).toBe("Detalhe do produto");
    expect(describePath("/promo")).toBe("/promo");
  });
});
