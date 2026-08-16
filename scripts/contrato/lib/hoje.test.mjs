import { describe, expect, it } from "vitest";
import { dataDeHoje } from "./hoje.mjs";

describe("dataDeHoje", () => {
  // Datas montadas com componentes LOCAIS: a asserção vale em qualquer fuso, o
  // que importa num teste que roda tanto no Brasil quanto no runner em UTC.
  it("devolve o dia do relógio local, não o do UTC", () => {
    // 23:30 do dia 15 — em UTC-3 isso já é dia 16 em UTC, e é exatamente o
    // horário em que `toISOString()` estragaria o carimbo do retrato.
    expect(dataDeHoje(new Date(2026, 7, 15, 23, 30))).toBe("2026-08-15");
    expect(dataDeHoje(new Date(2026, 7, 15, 0, 30))).toBe("2026-08-15");
  });

  it("preenche mês e dia com dois dígitos", () => {
    expect(dataDeHoje(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
    expect(dataDeHoje(new Date(2026, 11, 31, 12, 0))).toBe("2026-12-31");
  });
});
