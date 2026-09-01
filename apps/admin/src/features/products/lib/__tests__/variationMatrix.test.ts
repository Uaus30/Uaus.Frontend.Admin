import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import {
  chaveDaCombinacao,
  gerarCombinacoes,
  mesclarMatriz,
  nomeExibidoDaVariacao,
} from "../variationMatrix";
import type { ProductGrade, VariationDraft } from "../../types";

const COR: ProductGrade = { type: GRADE_TYPE.Color, values: ["Azul", "Preto"] };
const TAMANHO: ProductGrade = { type: GRADE_TYPE.Size, values: ["P", "M", "G"] };

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

describe("mesclarMatriz", () => {
  const draft = (key: string, cor: string, extra: Partial<VariationDraft> = {}): VariationDraft =>
    ({
      key,
      id: extra.id,
      barcode: extra.barcode ?? "",
      price: extra.price ?? 10,
      values: [{ gradeType: GRADE_TYPE.Color, value: cor }],
      ...extra,
    }) as VariationDraft;

  it("preserva o draft cuja combinação continua na matriz — id, preço e código sobrevivem", () => {
    // Regressão do bug mais caro da tela: regerar descartava tudo, os drafts
    // novos nasciam sem id e o salvar CRIAVA produtos novos, deixando os
    // antigos no banco — o grupo acumulava duplicatas até travar o cadastro.
    const azul = draft("product-1", "Azul", { id: 1, price: 12.5, barcode: "789" });
    const combinacoes = [
      [{ gradeType: GRADE_TYPE.Color, value: "Azul" }],
      [{ gradeType: GRADE_TYPE.Color, value: "Rosa" }],
    ];

    const { slots, removidas } = mesclarMatriz([azul], combinacoes);

    expect(slots).toHaveLength(2);
    expect(slots[0].existente).toBe(azul);
    expect(slots[1].existente).toBeNull();
    expect(removidas).toEqual([]);
  });

  it("casa a combinação ignorando ordem e caixa, como a chave manda", () => {
    const azulG = draft("product-1", "azul", {
      id: 1,
      values: [
        { gradeType: GRADE_TYPE.Size, value: "G" },
        { gradeType: GRADE_TYPE.Color, value: "azul" },
      ],
    });
    const combinacoes = [
      [
        { gradeType: GRADE_TYPE.Color, value: "AZUL" },
        { gradeType: GRADE_TYPE.Size, value: "g" },
      ],
    ];

    const { slots, removidas } = mesclarMatriz([azulG], combinacoes);

    expect(slots[0].existente).toBe(azulG);
    expect(removidas).toEqual([]);
  });

  it("manda para removidas o que saiu da matriz", () => {
    const azul = draft("product-1", "Azul", { id: 1 });
    const preto = draft("product-2", "Preto", { id: 2 });

    const { slots, removidas } = mesclarMatriz(
      [azul, preto],
      [[{ gradeType: GRADE_TYPE.Color, value: "Azul" }]],
    );

    expect(slots).toHaveLength(1);
    expect(slots[0].existente).toBe(azul);
    expect(removidas).toEqual([preto]);
  });

  it("com duplicata pré-existente, mantém a PRIMEIRA e remove a outra", () => {
    // É o estado que o próprio bug deixou no banco: duas variações com a mesma
    // combinação. A mesclagem aproveita a mais antiga e descarta a cópia.
    const original = draft("product-1", "Azul", { id: 1 });
    const copia = draft("product-9", "Azul", { id: 9 });

    const { slots, removidas } = mesclarMatriz(
      [original, copia],
      [[{ gradeType: GRADE_TYPE.Color, value: "Azul" }]],
    );

    expect(slots[0].existente).toBe(original);
    expect(removidas).toEqual([copia]);
  });
});

describe("mesclarMatriz — a matriz ganhando ou perdendo uma coluna", () => {
  const porTamanho = (value: string, id: number, barcode: string): VariationDraft =>
    ({
      key: `product-${id}`,
      id,
      barcode,
      price: 10,
      values: [{ gradeType: GRADE_TYPE.Size, value }],
    }) as VariationDraft;

  const cor = (value: string) => ({ gradeType: GRADE_TYPE.Color, value });
  const tamanho = (value: string) => ({ gradeType: GRADE_TYPE.Size, value });

  it("grade nova com UM valor aproveita as variações atuais, não cria linhas em branco", () => {
    // Regressão do relato de 01/09/2026: acrescentar "Cor: AZUL" a um produto
    // com "[10L]", "[6L]" e "[3,6L]" gerava três linhas novas com código de
    // barras vazio e deixava as três originais órfãs na tela.
    const atuais = [
      porTamanho("10L", 1, "2992110811678"),
      porTamanho("6L", 2, "7896725331443"),
      porTamanho("3,6L", 3, "7896725329402"),
    ];

    const { slots, removidas } = mesclarMatriz(atuais, [
      [cor("AZUL"), tamanho("10L")],
      [cor("AZUL"), tamanho("6L")],
      [cor("AZUL"), tamanho("3,6L")],
    ]);

    expect(slots.map((slot) => slot.existente)).toEqual(atuais);
    expect(removidas).toEqual([]);
  });

  it("grade nova com VÁRIOS valores dá as variações atuais ao primeiro valor", () => {
    const dezLitros = porTamanho("10L", 1, "2992110811678");
    const seisLitros = porTamanho("6L", 2, "7896725331443");

    const { slots, removidas } = mesclarMatriz(
      [dezLitros, seisLitros],
      [
        [cor("AZUL"), tamanho("10L")],
        [cor("AZUL"), tamanho("6L")],
        [cor("ROSA"), tamanho("10L")],
        [cor("ROSA"), tamanho("6L")],
      ],
    );

    expect(slots.map((slot) => slot.existente)).toEqual([dezLitros, seisLitros, null, null]);
    expect(removidas).toEqual([]);
  });

  it("tirar uma grade também preserva as variações", () => {
    const azulG = {
      key: "product-1",
      id: 1,
      barcode: "789",
      values: [cor("Azul"), tamanho("G")],
    } as VariationDraft;
    const azulP = {
      key: "product-2",
      id: 2,
      barcode: "790",
      values: [cor("Azul"), tamanho("P")],
    } as VariationDraft;

    const { slots, removidas } = mesclarMatriz([azulG, azulP], [[tamanho("G")], [tamanho("P")]]);

    expect(slots.map((slot) => slot.existente)).toEqual([azulG, azulP]);
    expect(removidas).toEqual([]);
  });

  it("valor que não existe mais continua saindo da matriz", () => {
    // O aproveitamento vale para grade que entra ou sai, não para valor
    // trocado: "[6L]" e "[8L]" discordam no Tamanho, são variações diferentes.
    const seisLitros = porTamanho("6L", 2, "7896725331443");

    const { slots, removidas } = mesclarMatriz(
      [porTamanho("10L", 1, "2992110811678"), seisLitros],
      [
        [cor("AZUL"), tamanho("10L")],
        [cor("AZUL"), tamanho("8L")],
      ],
    );

    expect(slots[1].existente).toBeNull();
    expect(removidas).toEqual([seisLitros]);
  });

  it("variação de outra grade não é aproveitada por combinação nenhuma", () => {
    // "Modelo: AZUL" e "Cor: AZUL" não têm grade em comum. Aproveitar aqui
    // casaria qualquer variação com qualquer slot; quem troca o tipo da grade é
    // a coluna da tabela, pelo `trocarTipoDeGrade`.
    const porModelo = {
      key: "product-1",
      id: 1,
      values: [{ gradeType: GRADE_TYPE.Model, value: "Azul" }],
    } as VariationDraft;

    const { slots, removidas } = mesclarMatriz([porModelo], [[cor("Azul")], [cor("Preto")]]);

    expect(slots.map((slot) => slot.existente)).toEqual([null, null]);
    expect(removidas).toEqual([porModelo]);
  });

  it("linha em branco não sequestra uma combinação", () => {
    const vazia = { key: "temp-1", values: [] } as unknown as VariationDraft;

    const { slots } = mesclarMatriz([vazia], [[cor("Azul")], [cor("Preto")]]);

    expect(slots.map((slot) => slot.existente)).toEqual([null, null]);
  });
});
