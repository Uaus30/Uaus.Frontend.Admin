import { describe, expect, it } from "vitest";
import {
  buildMonthOptions,
  buildYearOptions,
  closedMonthsOf,
  competenceOfPeriod,
  describePeriod,
  formatCompetence,
  formatCompetenceRange,
  lastEndedMonth,
  monthRange,
} from "../month-selection";

describe("monthRange", () => {
  it("deve montar o mês-calendário cheio em yyyy-MM-dd", () => {
    expect(monthRange({ year: 2026, month: 8 })).toEqual({
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });
  });

  it("deve acertar o último dia de fevereiro, inclusive em ano bissexto", () => {
    expect(monthRange({ year: 2026, month: 2 }).periodEnd).toBe("2026-02-28");
    expect(monthRange({ year: 2028, month: 2 }).periodEnd).toBe("2028-02-29");
  });
});

describe("lastEndedMonth", () => {
  it("deve devolver o mês anterior ao de referência", () => {
    expect(lastEndedMonth(new Date(2026, 8, 6))).toEqual({ year: 2026, month: 8 });
  });

  it("deve voltar para dezembro do ano anterior quando a referência é janeiro", () => {
    expect(lastEndedMonth(new Date(2026, 0, 10))).toEqual({ year: 2025, month: 12 });
  });
});

describe("buildYearOptions", () => {
  it("deve listar do ano atual para trás, sem ano futuro", () => {
    expect(buildYearOptions(new Date(2026, 8, 6))).toEqual([2026, 2025, 2024, 2023, 2022]);
  });
});

describe("closedMonthsOf", () => {
  it("deve marcar o mês de um fechamento mensal", () => {
    const closings = [{ periodStart: "2026-07-01T00:00:00", periodEnd: "2026-07-31T00:00:00" }];

    expect(closedMonthsOf(2026, closings)).toEqual([7]);
  });

  it("deve marcar todos os meses tocados por um fechamento de período livre", () => {
    // Fechamento antigo de 15/07 a 10/08 trava os dois meses: a confirmação de
    // qualquer um deles seria recusada por sobreposição.
    const closings = [{ periodStart: "2026-07-15", periodEnd: "2026-08-10" }];

    expect(closedMonthsOf(2026, closings)).toEqual([7, 8]);
  });

  it("deve considerar o fechamento que atravessa a virada do ano", () => {
    const closings = [{ periodStart: "2025-12-01", periodEnd: "2026-01-31" }];

    expect(closedMonthsOf(2026, closings)).toEqual([1]);
    expect(closedMonthsOf(2025, closings)).toEqual([12]);
  });

  it("deve ignorar fechamentos de outros anos", () => {
    const closings = [{ periodStart: "2025-03-01", periodEnd: "2025-03-31" }];

    expect(closedMonthsOf(2026, closings)).toEqual([]);
  });
});

describe("buildMonthOptions", () => {
  const reference = new Date(2026, 8, 6); // 06/09/2026

  it("deve separar disponível, em andamento, fechado e não iniciado", () => {
    const options = buildMonthOptions(2026, [7], reference);
    const byMonth = (month: number) => options[month - 1];

    expect(byMonth(7)).toMatchObject({ availability: "fechado", disabled: true });
    expect(byMonth(8)).toMatchObject({ availability: "disponivel", disabled: false });
    expect(byMonth(9)).toMatchObject({ availability: "em-andamento", disabled: false });
    expect(byMonth(10)).toMatchObject({ availability: "nao-iniciado", disabled: true });
  });

  it("deve liberar todos os meses de um ano passado sem fechamento", () => {
    const options = buildMonthOptions(2025, [], reference);

    expect(options).toHaveLength(12);
    expect(options.every((option) => option.availability === "disponivel")).toBe(true);
  });

  it("deve priorizar 'fechado' sobre 'não iniciado'", () => {
    const options = buildMonthOptions(2026, [12], reference);

    expect(options[11]).toMatchObject({ availability: "fechado", disabled: true });
  });

  it("deve nomear os meses em português", () => {
    expect(buildMonthOptions(2026, [], reference)[2].label).toBe("Março");
  });
});

describe("competenceOfPeriod", () => {
  it("deve reconhecer o mês-calendário cheio", () => {
    expect(
      competenceOfPeriod({ periodStart: "2026-08-01T00:00:00", periodEnd: "2026-08-31T00:00:00" }),
    ).toEqual({ year: 2026, month: 8 });
  });

  it("deve devolver null para período livre — o intervalo é a informação honesta", () => {
    expect(competenceOfPeriod({ periodStart: "2026-08-01", periodEnd: "2026-08-15" })).toBeNull();
    expect(competenceOfPeriod({ periodStart: "2026-07-15", periodEnd: "2026-08-31" })).toBeNull();
  });
});

describe("describePeriod", () => {
  it("deve usar a competência quando o fechamento cobre o mês cheio", () => {
    expect(describePeriod({ periodStart: "2026-08-01T00:00:00", periodEnd: "2026-08-31T00:00:00" })).toBe(
      "Agosto de 2026",
    );
  });

  it("deve cair no intervalo de datas nos fechamentos de período livre", () => {
    expect(describePeriod({ periodStart: "2026-07-15T00:00:00", periodEnd: "2026-08-10T00:00:00" })).toBe(
      "15/07/2026 — 10/08/2026",
    );
  });
});

describe("formatCompetence", () => {
  it("deve escrever a competência por extenso", () => {
    expect(formatCompetence({ year: 2026, month: 8 })).toBe("Agosto de 2026");
  });

  it("deve mostrar o período em pt-BR sem deslocar o dia pelo fuso", () => {
    // `new Date("2026-08-01")` seria lido como UTC e viraria 31/07 no Brasil.
    expect(formatCompetenceRange({ year: 2026, month: 8 })).toBe("01/08/2026 a 31/08/2026");
  });
});
