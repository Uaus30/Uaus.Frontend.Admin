import { afterEach, describe, expect, it } from "vitest";
import {
  formatMonthKey,
  monthKeyOf,
  monthKeyRange,
  monthName,
  monthNameOf,
  parseMonthKey,
  shiftMonthKey,
  toMonthKey,
} from "./month";

describe("monthName", () => {
  it("nomeia os meses em português, com inicial maiúscula", () => {
    expect(monthName(1)).toBe("Janeiro");
    expect(monthName(3)).toBe("Março");
    expect(monthName(12)).toBe("Dezembro");
  });

  it("devolve vazio fora de 1–12", () => {
    expect(monthName(0)).toBe("");
    expect(monthName(13)).toBe("");
  });
});

describe("toMonthKey", () => {
  const originalTimeZone = process.env.TZ;
  afterEach(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it("usa o mês LOCAL, e não o do UTC", () => {
    // 23h30 do dia 30 em Brasília já é dia 1º no UTC: `toISOString` abriria a
    // tela em dezembro.
    expect(toMonthKey(new Date(2026, 10, 30, 23, 30))).toBe("2026-11");
    expect(toMonthKey(new Date(2026, 0, 1, 0, 5))).toBe("2026-01");
  });

  it("dá o mesmo mês com o processo em UTC (o fuso do CI)", () => {
    process.env.TZ = "UTC";
    expect(new Date(2026, 9, 5, 14, 32).getTimezoneOffset()).toBe(0);

    expect(toMonthKey(new Date(2026, 10, 30, 23, 30))).toBe("2026-11");
  });
});

describe("parseMonthKey", () => {
  it("lê a chave e a data da API pelos dígitos, sem passar por Date", () => {
    expect(parseMonthKey("2026-11")).toEqual({ year: 2026, month: 11 });
    // `new Date("2026-11-01")` seria meia-noite UTC — 31/10 no Brasil.
    expect(parseMonthKey("2026-11-01")).toEqual({ year: 2026, month: 11 });
    expect(parseMonthKey("2026-11-01T00:00:00")).toEqual({ year: 2026, month: 11 });
  });

  it("recusa o que não é mês", () => {
    expect(parseMonthKey("")).toBeNull();
    expect(parseMonthKey(null)).toBeNull();
    expect(parseMonthKey(undefined)).toBeNull();
    expect(parseMonthKey("11/2026")).toBeNull();
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("2026-00")).toBeNull();
  });
});

describe("monthKeyOf", () => {
  it("completa o mês com zero", () => {
    expect(monthKeyOf({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("formatMonthKey e monthNameOf", () => {
  it("escrevem o mês por extenso", () => {
    expect(formatMonthKey("2026-11")).toBe("Novembro de 2026");
    expect(monthNameOf("2026-10-01T00:00:00")).toBe("Outubro");
  });

  it("devolvem vazio para chave ilegível", () => {
    expect(formatMonthKey("novembro")).toBe("");
    expect(monthNameOf(undefined)).toBe("");
  });
});

describe("monthKeyRange", () => {
  it("monta o primeiro e o último dia do mês", () => {
    expect(monthKeyRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(monthKeyRange("2026-12-15")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });

  it("acerta fevereiro, inclusive em ano bissexto", () => {
    expect(monthKeyRange("2026-02")?.end).toBe("2026-02-28");
    expect(monthKeyRange("2028-02")?.end).toBe("2028-02-29");
  });

  it("devolve null para chave ilegível", () => {
    expect(monthKeyRange("x")).toBeNull();
  });
});

describe("shiftMonthKey", () => {
  it("anda para frente e para trás atravessando a virada do ano", () => {
    expect(shiftMonthKey("2026-11", 1)).toBe("2026-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-03", -14)).toBe("2025-01");
  });

  it("devolve a entrada quando ela é ilegível", () => {
    expect(shiftMonthKey("novembro", 1)).toBe("novembro");
  });
});
