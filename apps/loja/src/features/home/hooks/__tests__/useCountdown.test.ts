import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCountdown, useCountdown } from "../useCountdown";

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

describe("useCountdown", () => {
  afterEach(() => vi.useRealTimers());

  it("desconta o tempo decorrido desde a LEITURA, e não a partir do zero", () => {
    // REGRESSÃO: sem a âncora, voltar para a home dentro do cache de 5 minutos
    // remontava o componente com o mesmo `endsInSeconds` e o relógio pulava de
    // 03:56:00 de volta para 04:00:00 — para trás, na frente da cliente.
    vi.useFakeTimers();
    const agora = Date.now();
    vi.setSystemTime(agora);

    const lidoHaQuatroMinutos = agora - 4 * 60 * 1000;
    const { result } = renderHook(() => useCountdown(4 * 60 * 60, lidoHaQuatroMinutos));

    expect(result.current).toBe(4 * 60 * 60 - 4 * 60);
  });

  it("zera quando a duração já passou — a aba que ficou aberta a noite inteira", () => {
    vi.useFakeTimers();
    const agora = Date.now();
    vi.setSystemTime(agora);

    const lidoHaSeisHoras = agora - 6 * 60 * 60 * 1000;
    const { result } = renderHook(() => useCountdown(4 * 60 * 60, lidoHaSeisHoras));

    expect(result.current).toBe(0);
  });

  it("sem duração, é zero e não liga relógio nenhum", () => {
    const { result } = renderHook(() => useCountdown(null, Date.now()));

    expect(result.current).toBe(0);
  });
});
