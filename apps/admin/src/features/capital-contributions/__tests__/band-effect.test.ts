import { describe, expect, it } from "vitest";
import { contributionBandEffect } from "../band-effect";

describe("contributionBandEffect", () => {
  it("diz a troca de faixa que o aporte provocou", () => {
    expect(contributionBandEffect("2026-11", { band: "Yellow" }, { band: "Green" })).toBe(
      "Novembro passou de amarelo para verde.",
    );
    expect(contributionBandEffect("2026-11", { band: "Red" }, { band: "Yellow" })).toBe(
      "Novembro passou de vermelho para amarelo.",
    );
  });

  it("diz que continua quando a faixa não mudou", () => {
    expect(contributionBandEffect("2026-10", { band: "Green" }, { band: "Green" })).toBe(
      "Outubro continua verde.",
    );
  });

  it("não inventa efeito quando uma das faixas não pôde ser lida", () => {
    expect(contributionBandEffect("2026-11", null, { band: "Green" })).toBeNull();
    expect(contributionBandEffect("2026-11", { band: "Green" }, { band: undefined })).toBeNull();
    expect(contributionBandEffect("x", { band: "Green" }, { band: "Green" })).toBeNull();
  });
});
