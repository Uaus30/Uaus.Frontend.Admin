import { describe, expect, it } from "vitest";
import { CLASS_ACTION, matrixCellReading, readConcentration } from "../abc";

describe("leitura da curva ABC", () => {
  it("a coluna Leitura responde 'bom ou ruim', que a classe sozinha não responde", () => {
    // A/B/C é escala ORDINAL: diz "mais" e "menos", nunca "melhor" e "pior". Um
    // classe A pode ser exatamente o que ocupa prateleira sem pagar por ela.
    expect(matrixCellReading("A", "A")).toMatchObject({ texto: "Motor da loja", tom: "bom" });
    expect(matrixCellReading("A", "C")).toMatchObject({
      texto: "Fatura mais do que lucra",
      tom: "atencao",
    });
    expect(matrixCellReading("C", "A")).toMatchObject({
      texto: "Lucra mais do que aparece",
      tom: "bom",
    });
    expect(matrixCellReading("B", "B")).toMatchObject({ texto: "Coerente", tom: "neutro" });
  });

  it("a cauda NÃO é vermelha", () => {
    // Pintá-la de vermelho é o empurrão para a decisão que a tela existe para
    // evitar: o item de classe C que aparece em cestas 60% maiores que a média
    // não é erro de compra, e cortá-lo leva a cesta inteira junto.
    const cauda = matrixCellReading("C", "C");

    expect(cauda.texto).toBe("Cauda");
    expect(cauda.tom).toBe("mudo");
    expect(cauda.dica).toContain("cesta");
  });

  it("cada classe carrega o que FAZER, e não só de onde o rótulo veio", () => {
    expect(CLASS_ACTION.A).toContain("não pode faltar");
    // "Cortar" é a tradução errada que saía sozinha da definição de C.
    expect(CLASS_ACTION.C).toContain("antes de cortar");
  });

  it("a manchete compara o medido com o previsto pela regra, sem presumir 20", () => {
    expect(readConcentration(38).tom).toBe("distribuida");
    expect(readConcentration(21).tom).toBe("pareto");
    expect(readConcentration(9).tom).toBe("concentrada");
  });
});
