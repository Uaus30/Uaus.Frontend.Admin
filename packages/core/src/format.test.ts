import { describe, expect, it } from "vitest";
import {
  formatBrasiliaDateTime,
  formatDate,
  formatShortDate,
  formatUpdatedAt,
  formatVersion,
  toDateKey,
} from "./format";

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

describe("formatBrasiliaDateTime", () => {
  it("converte data UTC para o horário de Brasília (UTC-3)", () => {
    // 15:45:12 UTC -> 12:45:12 em Brasília
    const dataUtc = "2026-08-22T15:45:12Z";
    expect(formatBrasiliaDateTime(dataUtc)).toBe("22/08/2026 às 12:45:12");
  });

  it("cruza a meia-noite corretamente para o dia anterior no fuso de Brasília", () => {
    // 01:30:00 UTC do dia 01/01 -> 22:30:00 do dia 31/12 em Brasília
    const dataUtc = "2026-01-01T01:30:00Z";
    expect(formatBrasiliaDateTime(dataUtc)).toBe("31/12/2025 às 22:30:00");
  });

  it("aceita objeto Date e timestamp numérico", () => {
    const data = new Date("2026-06-10T18:00:00Z");
    expect(formatBrasiliaDateTime(data)).toBe("10/06/2026 às 15:00:00");
    expect(formatBrasiliaDateTime(data.getTime())).toBe("10/06/2026 às 15:00:00");
  });

  it("devolve string vazia em caso de data inválida", () => {
    expect(formatBrasiliaDateTime("invalid-date")).toBe("");
  });
});

describe("formatVersion", () => {
  it("formata a versão sem prefixo 'v'", () => {
    expect(formatVersion("1.8.9")).toBe("Versão 1.8.9");
  });

  it("remove o prefixo 'v' se já vier com ele", () => {
    expect(formatVersion("v1.8.9")).toBe("Versão 1.8.9");
  });

  it("usa fallback para versão indefinida ou vazia", () => {
    expect(formatVersion(undefined)).toBe("Versão 0.0.0");
    expect(formatVersion("")).toBe("Versão 0.0.0");
  });
});

describe("formatUpdatedAt", () => {
  it("formata o texto completo de atualização", () => {
    const dataUtc = "2026-08-22T15:45:12Z";
    expect(formatUpdatedAt(dataUtc)).toBe("Atualizado em 22/08/2026 às 12:45:12");
  });

  it("devolve string vazia se timestamp for vazio ou inválido", () => {
    expect(formatUpdatedAt(undefined)).toBe("");
    expect(formatUpdatedAt("invalid")).toBe("");
  });
});
