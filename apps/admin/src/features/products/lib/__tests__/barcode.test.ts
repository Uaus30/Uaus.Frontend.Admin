import { describe, expect, it } from "vitest";
import { buildDisplayBarcode, calculateEan13CheckDigit, isEanValid, isFactoryEan } from "../barcode";

describe("isEanValid", () => {
  it("aceita EAN-8 e EAN-13", () => {
    expect(isEanValid("12345670")).toBe(true);
    expect(isEanValid("7891234567895")).toBe(true);
  });

  it("recusa comprimento fora do padrão e o que não é dígito", () => {
    // 12 dígitos é o PREFIXO do EAN-13, não um código: aceitar aqui faria a
    // prévia desenhar um código que o leitor do caixa recusa.
    expect(isEanValid("789123456789")).toBe(false);
    expect(isEanValid("789123456789A")).toBe(false);
    expect(isEanValid("")).toBe(false);
  });
});

describe("calculateEan13CheckDigit", () => {
  it("aplica os pesos alternados 1 e 3 do padrão GS1", () => {
    expect(calculateEan13CheckDigit("789123456789")).toBe(5);
  });

  it("devolve 0 quando a soma já fecha na dezena", () => {
    // O `% 10` de fora existe por causa deste caso: sem ele o dígito sairia 10.
    expect(calculateEan13CheckDigit("200000000077")).toBe(0);
  });
});

describe("buildDisplayBarcode", () => {
  it("mantém o EAN de fábrica que o operador digitou", () => {
    expect(buildDisplayBarcode("7891234567895", 10)).toBe("7891234567895");
    expect(buildDisplayBarcode("12345670", 10)).toBe("12345670");
  });

  it("gera código da faixa interna a partir do id quando não há EAN", () => {
    expect(buildDisplayBarcode("", 42)).toBe("2000000000428");
  });

  it("usa o que foi digitado como sufixo quando é numérico e cabe em 11 dígitos", () => {
    expect(buildDisplayBarcode("77", 42)).toBe("2000000000770");
  });

  it("ignora sufixo não numérico e volta para o id do produto", () => {
    expect(buildDisplayBarcode("ABC", 42)).toBe("2000000000428");
  });

  it("cai no 1 enquanto o produto não tem id", () => {
    // Produto ainda não salvo: a prévia é amostra, não o código definitivo.
    expect(buildDisplayBarcode("", null)).toBe("2000000000015");
  });
});

describe("isFactoryEan", () => {
  it("reconhece o EAN-13 impresso pelo fabricante", () => {
    expect(isFactoryEan("7891234567895")).toBe(true);
  });

  it("não confunde com o código interno gerado pela loja", () => {
    // Prefixo 2 é a faixa reservada para uso interno — piscar "achou o código
    // da embalagem" nela seria mentira.
    expect(isFactoryEan("2000000000428")).toBe(false);
  });

  it("não vale para EAN-8", () => {
    expect(isFactoryEan("12345670")).toBe(false);
  });
});
