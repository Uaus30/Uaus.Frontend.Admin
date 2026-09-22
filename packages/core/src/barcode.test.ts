import { describe, expect, it } from "vitest";
import {
  buildInternalBarcode,
  calculateEan13CheckDigit,
  hasValidEan13CheckDigit,
  isAllDigits,
  resolveBarcodeFormat,
  resolveBarcodeInput,
  EAN13_LENGTH,
} from "./barcode";

/**
 * Os códigos usados aqui são os do banco de verdade, colhidos no levantamento de
 * 21/09/2026 que motivou a padronização — inclusive os defeituosos.
 *
 * Esta bateria é gêmea de `Uaus.Api.Tests/Helpers/Ean13Tests.cs`: as duas pontas
 * têm que aceitar e recusar exatamente as mesmas entradas, senão a tela promete
 * um cadastro que a API recusa.
 */
describe("hasValidEan13CheckDigit", () => {
  it.each([
    "7908229101498", // TESOURA 8 POLEGADAS
    "9786527702559", // LIVRO: O VÍCIO DE AGRADAR
    "7891234567895",
    "2000000000251", // CUECA INFANTIL CORES, faixa interna herdada
    "2200000000903", // gerado pela sequence, valor 90
    "2200000001047", // gerado pela sequence, valor 104
  ])("aceita o código real %s", (code) => {
    expect(hasValidEan13CheckDigit(code)).toBe(true);
  });

  it.each([
    "2990532475152", // GIZ 7 BELO: verificador não fecha
    "2994598846768", // CALCINHA INFANTIL
    "7896665551252", // o código que deixou a prévia em branco em 07/09/2026
    "12345670", // EAN-8 é GTIN legítimo, mas não é EAN-13
    "717795464803", // 12 dígitos
    "79082291014981", // 14 dígitos
    "13-00001-01-WD",
    "",
  ])("recusa %s", (code) => {
    expect(hasValidEan13CheckDigit(code)).toBe(false);
  });
});

describe("calculateEan13CheckDigit", () => {
  it("devolve o dígito impresso na embalagem", () => {
    expect(calculateEan13CheckDigit("790822910149")).toBe(8);
    expect(calculateEan13CheckDigit("789123456789")).toBe(5);
    // Apurado em 07/09/2026, quando o código quebrou a prévia do cadastro.
    expect(calculateEan13CheckDigit("789666555125")).toBe(3);
  });

  it("devolve 0 quando a soma já fecha na dezena", () => {
    // O `% 10` de fora existe por causa deste caso: sem ele o dígito sairia 10,
    // e o código teria 14 caracteres.
    expect(calculateEan13CheckDigit("200000000077")).toBe(0);
  });
});

describe("isAllDigits", () => {
  it("separa dígito de qualquer outra coisa", () => {
    expect(isAllDigits("0020")).toBe(true);
    expect(isAllDigits("")).toBe(false);
    expect(isAllDigits("13-00001-01-WD")).toBe(false);
    expect(isAllDigits(" 123")).toBe(false);
  });
});

describe("resolveBarcodeInput", () => {
  it("campo vazio fica para a API gerar, sem prometer um número", () => {
    // A sequence vive no banco: inventar um código aqui mostraria na tela um
    // número diferente do que seria gravado.
    expect(resolveBarcodeInput("")).toEqual({ kind: "generated", code: null, error: null });
    expect(resolveBarcodeInput("   ")).toEqual({ kind: "generated", code: null, error: null });
  });

  it("apara o que vem em volta, como o espelho em C# faz", () => {
    // O leitor de código de barras costuma mandar um \r no fim, e quem digita
    // às vezes deixa espaço. Gêmeo de Ean13Tests.FromTyped_ShouldTrimLike…
    expect(resolveBarcodeInput(" 7908229101498 ").code).toBe("7908229101498");
    expect(resolveBarcodeInput("7908229101498\r\n").code).toBe("7908229101498");
    expect(resolveBarcodeInput("  0020  ").code).toBe("2000000000206");
  });

  it("preserva o código de fábrica como veio", () => {
    expect(resolveBarcodeInput("7908229101498")).toEqual({
      kind: "factory",
      code: "7908229101498",
      error: null,
    });
  });

  it("transforma número curto em código interno com o número legível dentro", () => {
    expect(resolveBarcodeInput("0020")).toEqual({
      kind: "internal",
      code: "2000000000206",
      error: null,
    });
  });

  it.each(["0101", "14090", "0020", "077", "1", "12345678901"])(
    "o número %s continua legível DENTRO do código gerado",
    (typed) => {
      // Requisito de operação, não estética: o caixa digita o código curto para
      // achar o produto, e a busca do PDV é `contains`. Quebrar esta propriedade
      // faz o operador deixar de encontrar produtos que ele acha hoje —
      // 0101 é o VAZINHO SUCULENTAS, 14090 é o VASO CUIA.
      const code = resolveBarcodeInput(typed).code as string;

      expect(code).toContain(typed);
      expect(hasValidEan13CheckDigit(code)).toBe(true);
    },
  );

  it.each(["1", "77", "0019", "12345678901"])("o código interno de %s é legível por leitor", (typed) => {
    const resolution = resolveBarcodeInput(typed);

    expect(resolution.kind).toBe("internal");
    expect(resolution.code).toHaveLength(EAN13_LENGTH);
    expect(hasValidEan13CheckDigit(resolution.code as string)).toBe(true);
  });

  it.each(["13-00001-01-WD", "BW0591-1", "2hqOr-", "623-2", "-3220"])(
    "recusa %s por não ser só dígito",
    (typed) => {
      const resolution = resolveBarcodeInput(typed);

      expect(resolution.kind).toBe("invalid");
      expect(resolution.error).toContain("apenas números");
    },
  );

  it.each(["٣٣٣", "１２３", "७७"])("recusa o dígito não-ASCII %s", (typed) => {
    // O espelho em C# usava `char.IsDigit`, que aceita todos eles, e gravava
    // '200000000٣٣٣9'. Os dois lados têm que recusar igual.
    const resolution = resolveBarcodeInput(typed);

    expect(resolution.kind).toBe("invalid");
    expect(resolution.error).toContain("apenas números");
  });

  it("recusa 13 dígitos com verificador torto dizendo qual seria o certo", () => {
    const resolution = resolveBarcodeInput("2990532475152");

    expect(resolution.kind).toBe("invalid");
    expect(resolution.error).toContain("deveria ser 6");
  });

  it("recusa 12 dígitos apontando o dígito que falta", () => {
    const resolution = resolveBarcodeInput("717795464803");

    expect(resolution.kind).toBe("invalid");
    expect(resolution.error).toContain("falta um dígito");
  });

  it.each(["79082291014981", "790822910149812345"])("recusa %s por passar de 13 dígitos", (typed) => {
    const resolution = resolveBarcodeInput(typed);

    expect(resolution.kind).toBe("invalid");
    expect(resolution.error).toContain("não cabe no padrão EAN-13");
  });

  it("a data tabulada no campo errado vira código interno legível", () => {
    // 11112025 tem 8 dígitos e nada impede que vire código interno; o que a
    // regra impede é ele continuar no catálogo como se fosse EAN-8 de fábrica.
    expect(resolveBarcodeInput("11112025").code).toBe("2000111120251");
  });
});

describe("buildInternalBarcode", () => {
  it("colide para números que só diferem em zero à esquerda", () => {
    // Consequência de preservar o número no miolo; quem barra a segunda
    // gravação é a checagem de duplicidade da API.
    expect(buildInternalBarcode("20")).toBe(buildInternalBarcode("0020"));
  });

  it.each(["123456789012", "", "12a"])("estoura em vez de truncar: %s", (digits) => {
    expect(() => buildInternalBarcode(digits)).toThrow();
  });
});

describe("resolveBarcodeFormat", () => {
  it("desenha EAN quando o verificador fecha", () => {
    expect(resolveBarcodeFormat("7908229101498")).toBe("EAN13");
    expect(resolveBarcodeFormat("12345670")).toBe("EAN8");
  });

  it("cai em CODE128 para o código congelado de lote antigo", () => {
    // `product_label_batch_items` guarda o código impresso na época. Reimprimir
    // um lote de antes da padronização ainda desenha estes.
    expect(resolveBarcodeFormat("2990532475152")).toBe("CODE128");
    expect(resolveBarcodeFormat("0020")).toBe("CODE128");
    expect(resolveBarcodeFormat("13-00001-01-WD")).toBe("CODE128");
  });
});
