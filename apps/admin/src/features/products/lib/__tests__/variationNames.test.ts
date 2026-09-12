import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { chaveDaCombinacao, nomeExibidoDaVariacao, opcoesDeVariacao } from "../variationNames";
import type { VariationDraft } from "../../types";

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

describe("opcoesDeVariacao", () => {
  const variacao = (id: number | null, tamanho: string, modelo: string): VariationDraft =>
    ({
      id,
      key: id ? `product-${id}` : "temp-1",
      name: "CUECA INFANTIL CORES",
      values: [
        { gradeType: GRADE_TYPE.Size, value: tamanho },
        { gradeType: GRADE_TYPE.Model, value: modelo },
      ],
    }) as VariationDraft;

  it("ordena por id crescente — a mesma ordem da tabela da aba Dados", () => {
    // Era alfabético, e as duas telas mostravam a mesma lista em ordens
    // diferentes. A primeira opção passa a ser a variação mais antiga, que num
    // produto convertido é a que ficou com o estoque.
    const opcoes = opcoesDeVariacao(
      [variacao(1080, "GG", "BOXER"), variacao(213, "G", "SLIP"), variacao(1077, "P", "BOXER")],
      "CUECA INFANTIL CORES",
    );

    expect(opcoes.map((opcao) => opcao.id)).toEqual([213, 1077, 1080]);
  });

  it("o rótulo é só a configuração, sem o nome do produto", () => {
    // "CUECA INFANTIL CORES [G, SLIP]" não cabia no seletor: o que distingue
    // uma variação da outra ficava cortado no fim.
    const [opcao] = opcoesDeVariacao([variacao(213, "G", "SLIP")], "CUECA INFANTIL CORES");

    expect(opcao.label).toBe("G, SLIP");
  });

  it("variação sem grade nenhuma cai no nome do grupo, para não virar opção em branco", () => {
    const semGrade = { id: 5, key: "product-5", values: [] } as unknown as VariationDraft;

    expect(opcoesDeVariacao([semGrade], "CANECA")[0].label).toBe("CANECA");
  });

  it("linha ainda não salva fica de fora: estoque é do produto gravado", () => {
    expect(opcoesDeVariacao([variacao(null, "M", "BOXER")], "CUECA INFANTIL CORES")).toEqual([]);
  });
});
