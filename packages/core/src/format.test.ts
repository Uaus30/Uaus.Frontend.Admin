import { afterEach, describe, expect, it } from "vitest";
import {
  formatBrasiliaDateTime,
  formatDate,
  formatShortDate,
  formatUpdatedAt,
  formatVersion,
  versionNumber,
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

describe("formatBrasiliaDateTime com a data da API (Brasília, sem fuso declarado)", () => {
  // O CI do GitHub roda em UTC e a máquina de quem desenvolve, em Brasília: um
  // teste que passa só num dos dois deixou a `main` vermelha de 05 a 06/10/2026.
  // Aqui o fuso do processo é trocado de propósito, para o defeito aparecer em
  // qualquer máquina, e não só no CI ou no celular de quem está fora de Brasília.
  const originalTimeZone = process.env.TZ;
  afterEach(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it.each([
    ["UTC", 0],
    ["America/Manaus", 240],
    ["Asia/Tokyo", -540],
    ["America/Sao_Paulo", 180],
  ])("mostra a hora que a API mandou, com o aparelho em %s", (timeZone, offsetMinutes) => {
    process.env.TZ = timeZone;
    // Prova de que a troca de fuso pegou: sem ela o teste passaria à toa.
    expect(new Date(2026, 9, 5, 14, 32).getTimezoneOffset()).toBe(offsetMinutes);

    expect(formatBrasiliaDateTime("2026-10-05T14:32:10")).toBe("05/10/2026 às 14:32:10");
    // Logo depois da meia-noite: lida no fuso do aparelho, voltava para o dia anterior.
    expect(formatBrasiliaDateTime("2026-10-06T00:30:00")).toBe("06/10/2026 às 00:30:00");
    // O .NET manda até sete casas de fração de segundo.
    expect(formatBrasiliaDateTime("2026-10-05T23:59:59.1234567")).toBe("05/10/2026 às 23:59:59");
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

describe("versionNumber", () => {
  it("deve devolver o número sem o rótulo", () => {
    // O menu do PDV escreve "Versão" por conta própria, à esquerda e em outra
    // cor: com o rótulo junto a linha saía "VERSÃO  Versão 2.3.1".
    expect(versionNumber("1.8.9")).toBe("1.8.9");
  });

  it("deve tirar o v inicial, como o rótulo faz", () => {
    expect(versionNumber("v1.8.9")).toBe("1.8.9");
  });

  it("deve cair em 0.0.0 sem versão informada", () => {
    expect(versionNumber(undefined)).toBe("0.0.0");
    expect(versionNumber("")).toBe("0.0.0");
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
