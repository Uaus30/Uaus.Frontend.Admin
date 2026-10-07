import { describe, expect, it } from "vitest";
import { staleLocalDataSince, type StaleLocalDataInput } from "./stale-local-data";

/** 07/10/2026, 10h no horário do aparelho. */
const NOW = new Date(2026, 9, 7, 10, 0, 0);

function input(overrides: Partial<StaleLocalDataInput> = {}): StaleLocalDataInput {
  return {
    online: false,
    isSessionFromCache: true,
    sessionOpenedAt: "2026-10-07T08:00:00",
    snapshotDownloadedAt: new Date(2026, 9, 7, 8, 1, 0).toISOString(),
    now: NOW,
    ...overrides,
  };
}

describe("staleLocalDataSince", () => {
  it("caixa e base de hoje: nada a avisar", () => {
    expect(staleLocalDataSince(input())).toBeNull();
  });

  it("sem internet com o caixa de ontem: avisa o dia do caixa", () => {
    // O celular que não abriu o PDV com internet hoje: o caixa de ontem pode já
    // ter sido fechado no computador, e a venda seria recusada ao subir.
    expect(staleLocalDataSince(input({ sessionOpenedAt: "2026-10-06T08:00:00" }))).toBe("06/10/2026");
  });

  it("sem internet com a base de dois dias atrás: avisa o dia mais antigo", () => {
    expect(
      staleLocalDataSince(
        input({
          sessionOpenedAt: "2026-10-06T08:00:00",
          snapshotDownloadedAt: new Date(2026, 9, 5, 18, 0, 0).toISOString(),
        }),
      ),
    ).toBe("05/10/2026");
  });

  it("com internet não avisa: o PDV lê o caixa e os preços de agora", () => {
    expect(staleLocalDataSince(input({ online: true, sessionOpenedAt: "2026-10-06T08:00:00" }))).toBeNull();
  });

  it("a sessão que veio do servidor não conta, mesmo aberta ontem", () => {
    // Caixa aberto ontem e ainda aberto no servidor: o servidor respondeu, a
    // sessão é real. Só a cópia local é suspeita.
    expect(
      staleLocalDataSince(input({ isSessionFromCache: false, sessionOpenedAt: "2026-10-06T08:00:00" })),
    ).toBeNull();
  });

  it("a hora da API (sem fuso) vale como está: 23h de ontem é ontem em qualquer aparelho", () => {
    expect(staleLocalDataSince(input({ sessionOpenedAt: "2026-10-06T23:30:00" }))).toBe("06/10/2026");
  });

  it("aparelho que nunca baixou a base, sem sessão: nada a comparar", () => {
    expect(staleLocalDataSince(input({ sessionOpenedAt: null, snapshotDownloadedAt: null }))).toBeNull();
  });
});
