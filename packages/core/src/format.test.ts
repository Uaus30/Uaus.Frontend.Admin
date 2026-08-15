import { describe, expect, it } from "vitest";
import { formatDate, formatShortDate, toDateKey } from "./format";

describe("formatShortDate", () => {
  it("formata a data no padrão pt-BR", () => {
    expect(formatShortDate("2026-08-15T14:30:00")).toBe("15/08/2026");
  });

  it("preserva o dia de datas no início do mês", () => {
    expect(formatShortDate("2026-01-01T00:00:00")).toBe("01/01/2026");
  });
});

describe("formatDate", () => {
  it("inclui hora e minuto", () => {
    // A vírgula é do Intl pt-BR, não uma escolha nossa — fica no teste para
    // ninguém "corrigir" o separador achando que é typo.
    expect(formatDate("2026-08-15T14:30:00")).toBe("15/08/2026, 14:30");
  });
});

describe("toDateKey", () => {
  it("usa o fuso local, não UTC", () => {
    // Regressão: `toISOString().slice(0, 10)` numa data local de fim de dia
    // devolve o dia SEGUINTE no Brasil (UTC-3), então "hoje" virava "amanhã"
    // nos filtros de período. Aqui a data é montada a partir dos getters locais.
    const fimDoDia = new Date(2026, 7, 15, 23, 30, 0);

    expect(toDateKey(fimDoDia)).toBe("2026-08-15");
  });

  it("não desloca o dia em datas de início de dia", () => {
    const inicioDoDia = new Date(2026, 7, 15, 0, 15, 0);

    expect(toDateKey(inicioDoDia)).toBe("2026-08-15");
  });

  it("preenche mês e dia com zero à esquerda", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("atravessa a virada de ano sem erro", () => {
    expect(toDateKey(new Date(2026, 11, 31, 22, 0, 0))).toBe("2026-12-31");
  });
});
