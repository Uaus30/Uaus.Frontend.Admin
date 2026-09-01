import { describe, expect, it } from "vitest";
import { tokenizeSearchTerms } from "./search";

/**
 * Estes casos são os MESMOS de `SearchTermsTests.cs` no backend, de propósito.
 *
 * A busca do balcão troca de motor conforme a internet: com rede vai ao
 * servidor, sem rede vai à base local. Se as duas regras divergirem, o operador
 * acha o produto num momento e não acha no outro, e nada na tela explica.
 */
describe("tokenizeSearchTerms", () => {
  it("quebra o termo em palavras", () => {
    expect(tokenizeSearchTerms("bacia plastica tampa")).toEqual(["bacia", "plastica", "tampa"]);
  });

  it("ignora acento e caixa", () => {
    expect(tokenizeSearchTerms("SACOLA REUTILIZÁVEL")).toEqual(["sacola", "reutilizavel"]);
  });

  it("descarta preposição e artigo", () => {
    // O caso que motivou a lista: no cadastro o "com" está escrito "C/"
    // ("BACIA PLASTICA 2L C/ TAMPA"). Exigi-lo derrubaria o resultado.
    expect(tokenizeSearchTerms("bacia com tampa")).toEqual(["bacia", "tampa"]);
    expect(tokenizeSearchTerms("pano de prato")).toEqual(["pano", "prato"]);
  });

  it("mantém as palavras vazias quando é só o que o termo tem", () => {
    // Quem digitou "para" procura "para" (o cabo de para-raios). Devolver vazio
    // aqui viraria "sem termo", que lista o catálogo inteiro.
    expect(tokenizeSearchTerms("para")).toEqual(["para"]);
    expect(tokenizeSearchTerms("de e com")).toEqual(["de", "e", "com"]);
  });

  it("quebra também na pontuação", () => {
    // Quebrar só torna a busca mais permissiva: "coca-cola" continua achando o
    // cadastro que escreve junto, porque os dois pedaços estão lá.
    expect(tokenizeSearchTerms("coca-cola")).toEqual(["coca", "cola"]);
    expect(tokenizeSearchTerms("parafuso 3/8")).toEqual(["parafuso", "3", "8"]);
  });

  it("repete palavra uma vez só", () => {
    expect(tokenizeSearchTerms("bacia bacia")).toEqual(["bacia"]);
  });

  it("limita a quantidade de palavras", () => {
    const termo = "um dois tres quatro cinco seis sete oito nove dez onze";

    expect(tokenizeSearchTerms(termo)).toHaveLength(8);
  });

  it.each([undefined, null, "", "   ", "..."])("devolve vazio sem termo útil: %p", (termo) => {
    expect(tokenizeSearchTerms(termo)).toEqual([]);
  });
});
