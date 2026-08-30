import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import {
  chaveDaCombinacao,
  gerarCombinacoes,
  gradesDasVariacoes,
  nomeExibidoDaVariacao,
  ordenarGrades,
} from "../variationMatrix";
import type { ProductGrade, VariationDraft } from "../../types";

const COR: ProductGrade = { type: GRADE_TYPE.Color, values: ["Azul", "Preto"] };
const TAMANHO: ProductGrade = { type: GRADE_TYPE.Size, values: ["P", "M", "G"] };

describe("ordenarGrades", () => {
  it("põe Cor antes de Tamanho antes de Modelo, não a ordem dos cliques", () => {
    // Sem ordem fixa, o mesmo produto sairia "[AZUL, G]" ou "[G, AZUL]"
    // conforme a ordem em que o operador marcou as caixas.
    const ordenadas = ordenarGrades([TAMANHO, { type: GRADE_TYPE.Model, values: ["X"] }, COR]);

    expect(ordenadas.map((g) => g.type)).toEqual([GRADE_TYPE.Color, GRADE_TYPE.Size, GRADE_TYPE.Model]);
  });

  it("descarta grade sem valor e apara espaço dos valores", () => {
    const ordenadas = ordenarGrades([
      { type: GRADE_TYPE.Color, values: [" Azul ", "  "] },
      { type: GRADE_TYPE.Size, values: [] },
    ]);

    expect(ordenadas).toEqual([{ type: GRADE_TYPE.Color, values: ["Azul"] }]);
  });
});

describe("gerarCombinacoes", () => {
  it("cruza as grades, uma combinação por variação", () => {
    const combinacoes = gerarCombinacoes([COR, TAMANHO]);

    expect(combinacoes).toHaveLength(6);
    expect(combinacoes[0]).toEqual([
      { gradeType: GRADE_TYPE.Color, value: "Azul" },
      { gradeType: GRADE_TYPE.Size, value: "P" },
    ]);
    expect(combinacoes.at(-1)).toEqual([
      { gradeType: GRADE_TYPE.Color, value: "Preto" },
      { gradeType: GRADE_TYPE.Size, value: "G" },
    ]);
  });

  it("uma grade só gera uma variação por valor", () => {
    expect(gerarCombinacoes([TAMANHO])).toHaveLength(3);
  });

  it("sem grade não gera nada — é por isso que a modal exige uma", () => {
    expect(gerarCombinacoes([])).toEqual([]);
    expect(gerarCombinacoes([{ type: GRADE_TYPE.Color, values: [] }])).toEqual([]);
  });
});

describe("nomeExibidoDaVariacao", () => {
  it("monta o nome igual ao que o backend vai compor", () => {
    // Espelha `ProductDisplayName.Compose`. Divergir daqui é divergir do cupom.
    const nome = nomeExibidoDaVariacao("Camiseta", [
      { gradeType: GRADE_TYPE.Color, value: "Azul" },
      { gradeType: GRADE_TYPE.Size, value: "G" },
    ]);

    expect(nome).toBe("CAMISETA [AZUL, G]");
  });

  it("variação sem valor mostra só o nome do grupo", () => {
    expect(nomeExibidoDaVariacao("Camiseta", [])).toBe("Camiseta");
  });
});

describe("chaveDaCombinacao", () => {
  it("não depende da ordem nem da caixa", () => {
    // Duas variações com a mesma combinação escrita de formas diferentes
    // continuam sendo a mesma variação, e o salvamento precisa recusá-las.
    const a = chaveDaCombinacao([
      { gradeType: GRADE_TYPE.Size, value: "g" },
      { gradeType: GRADE_TYPE.Color, value: "Azul" },
    ]);
    const b = chaveDaCombinacao([
      { gradeType: GRADE_TYPE.Color, value: " AZUL " },
      { gradeType: GRADE_TYPE.Size, value: "G" },
    ]);

    expect(a).toBe(b);
  });

  it("distingue combinações diferentes", () => {
    const azul = chaveDaCombinacao([{ gradeType: GRADE_TYPE.Color, value: "Azul" }]);
    const preto = chaveDaCombinacao([{ gradeType: GRADE_TYPE.Color, value: "Preto" }]);

    expect(azul).not.toBe(preto);
  });
});

describe("gradesDasVariacoes", () => {
  it("reconstrói grades e valores a partir das variações gravadas", () => {
    // É o que faz a modal reabrir marcada com o que o produto já tem. Sem isto,
    // reconfigurar começaria em branco e a matriz nova apagaria tudo.
    const drafts = [
      { values: [{ gradeType: GRADE_TYPE.Color, value: "Azul" }] },
      { values: [{ gradeType: GRADE_TYPE.Color, value: "Preto" }] },
      { values: [{ gradeType: GRADE_TYPE.Color, value: "azul" }] },
    ] as VariationDraft[];

    expect(gradesDasVariacoes(drafts)).toEqual([{ type: GRADE_TYPE.Color, values: ["Azul", "Preto"] }]);
  });

  it("devolve lista vazia para produto sem grade", () => {
    expect(gradesDasVariacoes([{ values: [] } as unknown as VariationDraft])).toEqual([]);
  });

  it("ignora valor de grade cujo tipo não foi normalizado", () => {
    // Regressão: o backend serializa enum como NOME ("Color"), e a variação
    // chegava com `gradeType: "Color"` em vez de 2. A modal reabria com as
    // caixas DESMARCADAS e a tabela mostrava a coluna como "Grade" — sem erro
    // em lugar nenhum. Quem normaliza é o `enumCode` na fronteira
    // (`useProductEditor.toVariationDraft`); aqui só se garante que o tipo cru
    // não passa por engano como se fosse código.
    const comString = [{ values: [{ gradeType: "Color", value: "Azul" }] }] as unknown as VariationDraft[];

    expect(gradesDasVariacoes(comString).map((g) => g.type)).not.toContain(GRADE_TYPE.Color);
  });
});
