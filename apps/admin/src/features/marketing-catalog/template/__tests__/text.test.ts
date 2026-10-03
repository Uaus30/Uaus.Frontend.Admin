import { describe, expect, it } from "vitest";
import {
  formatPrice,
  formatStoreDate,
  normalizeTitle,
  priceDisclaimer,
  splitPrice,
  storeDateKey,
  TITLE_MAX_LENGTH,
  titleFontSize,
} from "../text";

describe("splitPrice", () => {
  it("parte reais e centavos no formato brasileiro", () => {
    expect(splitPrice(19.9)).toEqual({ whole: "19", cents: "90" });
    expect(splitPrice(3)).toEqual({ whole: "3", cents: "00" });
  });

  it("preço abaixo de um real mantém o zero dos reais", () => {
    expect(splitPrice(0.25)).toEqual({ whole: "0", cents: "25" });
  });

  it("arredonda meio centavo para cima, como o balcão", () => {
    // `toFixed` sozinho devolveria 1,00: 1.005 em binário é 1.00499999…
    expect(splitPrice(1.005)).toEqual({ whole: "1", cents: "01" });
  });

  it("separa o milhar com ponto", () => {
    expect(splitPrice(1234.5)).toEqual({ whole: "1.234", cents: "50" });
  });

  it("preço negativo não chega à peça: vira zero", () => {
    expect(splitPrice(-5)).toEqual({ whole: "0", cents: "00" });
  });
});

describe("formatPrice", () => {
  it("escreve o 'de' da oferta por extenso", () => {
    expect(formatPrice(25)).toBe("R$ 25,00");
  });
});

describe("formatStoreDate", () => {
  it("usa o dia de Brasília, e não o do fuso do aparelho", () => {
    // 01:30 UTC de 04/10 ainda é 22:30 de 03/10 na loja.
    expect(formatStoreDate(new Date("2026-10-04T01:30:00Z"))).toBe("03/10/2026");
  });

  it("vira o dia à meia-noite de Brasília", () => {
    expect(formatStoreDate(new Date("2026-10-04T03:00:00Z"))).toBe("04/10/2026");
  });
});

describe("storeDateKey", () => {
  it("escreve o dia de Brasília como ano-mês-dia", () => {
    expect(storeDateKey(new Date("2026-10-03T15:00:00Z"))).toBe("2026-10-03");
    // 02:00 UTC do dia 4 ainda são 23:00 do dia 3 na loja.
    expect(storeDateKey(new Date("2026-10-04T02:00:00Z"))).toBe("2026-10-03");
  });
});

describe("priceDisclaimer", () => {
  it("traz a data, o aviso de alteração de preço e o das imagens", () => {
    const text = priceDisclaimer(new Date("2026-10-03T15:00:00Z"));

    expect(text).toBe(
      "Preços de referência em 03/10/2026, sujeitos a alteração sem aviso e à disponibilidade de estoque. " +
        "Imagens meramente ilustrativas.",
    );
  });
});

describe("título do cabeçalho", () => {
  it("tira espaço sobrando das pontas e do meio", () => {
    expect(normalizeTitle("  Utilidades   de  cozinha ")).toBe("Utilidades de cozinha");
  });

  it("corta no teto sem deixar espaço pendurado no fim", () => {
    const title = normalizeTitle("Catálogo de brinquedos e presentes para o Dia das Crianças");

    expect(title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
    expect(title).toBe(title.trim());
  });

  it("diminui o corpo conforme o título cresce, nos quatro degraus", () => {
    expect(titleFontSize("Brinquedos")).toBe(64);
    expect(titleFontSize("Novidades e promoções")).toBe(54);
    expect(titleFontSize("Utilidades de cozinha e mesa")).toBe(46);
    expect(titleFontSize("Banheiro, limpeza e organização")).toBe(38);
  });

  it("os limites de cada degrau são inclusivos", () => {
    expect(titleFontSize("a".repeat(18))).toBe(64);
    expect(titleFontSize("a".repeat(19))).toBe(54);
    expect(titleFontSize("a".repeat(24))).toBe(54);
    expect(titleFontSize("a".repeat(30))).toBe(46);
    expect(titleFontSize("a".repeat(31))).toBe(38);
  });
});
