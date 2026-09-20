import { describe, expect, it } from "vitest";
import { describeAspectMismatch } from "../promotionArtRules";

/**
 * A proporção da arte é AVISO, nunca recusa (§7.4).
 *
 * A loja pode ter uma arte 1:1 pronta e querer usá-la assim mesmo; travar o
 * upload por causa de dez pixels seria o sistema decidindo direção de arte. O
 * que estes testes protegem é o contrário: que o aviso apareça quando serve e
 * cale quando não serve — aviso que grita em arquivo certo é aviso que ninguém
 * lê depois.
 */
describe("describeAspectMismatch", () => {
  it("cala nas proporções exatas", () => {
    expect(describeAspectMismatch(1080, 1350, "feed")).toBeUndefined();
    expect(describeAspectMismatch(1080, 1920, "story")).toBeUndefined();
  });

  it("cala num corte de poucos pixels", () => {
    // 1078×1350 é 4:5 para qualquer efeito prático.
    expect(describeAspectMismatch(1078, 1350, "feed")).toBeUndefined();
  });

  it("avisa quando a arte é quadrada e o slot é 4:5", () => {
    const aviso = describeAspectMismatch(1080, 1080, "feed");

    expect(aviso).toContain("1080×1080");
    expect(aviso).toContain("4:5");
  });

  it("avisa quando a arte do feed foi posta no slot do Stories", () => {
    // Troca de slot é o engano mais provável: os dois arquivos saem juntos da
    // ferramenta de IA, com nomes parecidos.
    expect(describeAspectMismatch(1080, 1350, "story")).toContain("9:16");
  });

  it("não quebra com dimensão zero", () => {
    expect(describeAspectMismatch(0, 0, "feed")).toBeUndefined();
  });
});
