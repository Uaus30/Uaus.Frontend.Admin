import { describe, expect, it } from "vitest";
import { escapeHtml, normalizeSearchText } from "./text";

describe("normalizeSearchText", () => {
  it("remove acentos", () => {
    expect(normalizeSearchText("José")).toBe("jose");
    expect(normalizeSearchText("açúcar")).toBe("acucar");
    expect(normalizeSearchText("PÃO DE MEL")).toBe("pao de mel");
  });

  it("baixa a caixa e apara as pontas", () => {
    expect(normalizeSearchText("  Coca-Cola  ")).toBe("coca-cola");
  });

  it("preserva espaços internos, números e pontuação", () => {
    expect(normalizeSearchText("Água 500 ml")).toBe("agua 500 ml");
  });

  it("é idempotente", () => {
    const uma = normalizeSearchText("Açaí");

    expect(normalizeSearchText(uma)).toBe(uma);
  });

  it("aceita texto vazio", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
  });

  it("faz a busca sem acento encontrar o cadastro com acento", () => {
    const cadastro = normalizeSearchText("Café Torrado");

    expect(cadastro.includes(normalizeSearchText("cafe"))).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("escapa os caracteres que quebram o HTML", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapa aspa dupla E aspa simples", () => {
    // A aspa simples é a diferença que motivou a unificação: a versão do cupom
    // não a escapava, então o mesmo nome saía seguro na etiqueta e inseguro no
    // cupom.
    expect(escapeHtml('Caneca "P"')).toBe("Caneca &quot;P&quot;");
    expect(escapeHtml("Caneca 'P'")).toBe("Caneca &#39;P&#39;");
  });

  it("escapa o & primeiro, para não escapar duas vezes", () => {
    // Ordem errada transformaria "<" em "&amp;lt;".
    expect(escapeHtml("&<")).toBe("&amp;&lt;");
  });

  it("deixa texto comum intacto", () => {
    expect(escapeHtml("Café Torrado 500g")).toBe("Café Torrado 500g");
  });
});
