import { describe, expect, it } from "vitest";
import { normalizeSearchText } from "./text";

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
