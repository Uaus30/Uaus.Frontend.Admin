import { describe, expect, it } from "vitest";
import { formatCountdown } from "../useCountdown";

/**
 * A contagem do banner.
 *
 * O que está protegido é a leitura: o número fica na frente da cliente mudando
 * a cada segundo, e é ele que decide se ela sai de casa agora.
 */
describe("formatCountdown", () => {
  it("mostra horas, minutos e segundos com dois dígitos", () => {
    // Horas SEMPRE presentes: a relâmpago dura horas, e "45:09" seria lido como
    // quarenta e cinco minutos quando faltam quarenta e cinco horas.
    expect(formatCountdown(3 * 3600 + 5 * 60 + 9)).toBe("03:05:09");
    expect(formatCountdown(59)).toBe("00:00:59");
  });

  it("não devolve tempo negativo", () => {
    // O relógio do visitante pode estar adiantado; "-00:00:03" no topo da home
    // é pior que zero.
    expect(formatCountdown(-10)).toBe("00:00:00");
    expect(formatCountdown(0)).toBe("00:00:00");
  });
});
