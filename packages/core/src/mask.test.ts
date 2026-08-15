import { describe, expect, it } from "vitest";
import { cleanPhone, formatPhone } from "./mask";

describe("cleanPhone", () => {
  it("mantém só os dígitos", () => {
    expect(cleanPhone("(11) 91234-5678")).toBe("11912345678");
  });

  it("remove o zero de discagem digitado antes do DDD", () => {
    expect(cleanPhone("011912345678")).toBe("11912345678");
  });

  it("trunca em 11 dígitos", () => {
    expect(cleanPhone("119123456789999")).toBe("11912345678");
  });

  it("devolve vazio quando não há dígito", () => {
    expect(cleanPhone("")).toBe("");
    expect(cleanPhone("(-) ")).toBe("");
  });
});

describe("formatPhone", () => {
  it("mascara celular com nove dígitos", () => {
    expect(formatPhone("11912345678")).toBe("(11) 91234-5678");
  });

  it("mascara fixo com oito dígitos", () => {
    expect(formatPhone("1134567890")).toBe("(11) 3456-7890");
  });

  it("aplica a máscara progressivamente enquanto o usuário digita", () => {
    // Progressiva de propósito: fechar o parêntese antes da hora faz o cursor
    // pular no meio da digitação.
    expect(formatPhone("1")).toBe("(1");
    expect(formatPhone("11")).toBe("(11");
    expect(formatPhone("119")).toBe("(11) 9");
    expect(formatPhone("1191234")).toBe("(11) 9123-4");
  });

  it("devolve vazio quando não há dígito", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("abc")).toBe("");
  });

  it("é idempotente sobre o próprio resultado", () => {
    // O campo remascara a cada tecla, então formatar o já formatado é o caminho
    // normal — não pode acumular parênteses.
    const uma = formatPhone("11912345678");

    expect(formatPhone(uma)).toBe(uma);
  });
});
