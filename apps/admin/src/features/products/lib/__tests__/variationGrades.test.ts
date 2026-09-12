import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { aplicarGradesNasLinhas, gradesDasVariacoes, trocarTipoDeGrade } from "../variationGrades";
import type { VariationDraft } from "../../types";

describe("gradesDasVariacoes", () => {
  it("reconstrói grades e valores a partir das variações gravadas", () => {
    // É o que faz a modal reabrir marcada com o que o produto já tem — e o que
    // desenha as colunas da tabela. Sem isto, reconfigurar começaria em branco
    // e desmarcaria as grades que o produto usa.
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

  it("mantém a grade que ainda não tem valor nenhum", () => {
    // É a coluna em branco que a modal acrescenta num produto já cadastrado.
    // Filtrada aqui, ela sumiria no mesmo render em que apareceu.
    const comColunaVazia = [
      { values: [{ gradeType: GRADE_TYPE.Color, value: "" }] },
    ] as unknown as VariationDraft[];

    expect(gradesDasVariacoes(comColunaVazia)).toEqual([{ type: GRADE_TYPE.Color, values: [] }]);
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

describe("trocarTipoDeGrade", () => {
  const comGrade = (type: number, value: string) =>
    ({ key: `k-${value}`, values: [{ gradeType: type, value }] }) as VariationDraft;

  it("renomeia a grade em todas as variações, sem tocar nos valores", () => {
    // É a correção da importação do sistema anterior: o valor é uma cor, mas a
    // grade veio como "Modelo". Desmarcar "Modelo" e marcar "Cor" na modal
    // apagaria a coluna com os valores dentro, e as centenas de variações
    // importadas teriam que ser redigitadas uma a uma.
    const drafts = [comGrade(GRADE_TYPE.Model, "Azul"), comGrade(GRADE_TYPE.Model, "Preto")];

    const trocados = trocarTipoDeGrade(drafts, GRADE_TYPE.Model, GRADE_TYPE.Color);

    expect(trocados.map((d) => d.values)).toEqual([
      [{ gradeType: GRADE_TYPE.Color, value: "Azul" }],
      [{ gradeType: GRADE_TYPE.Color, value: "Preto" }],
    ]);
  });

  it("recusa a troca quando o tipo de destino já está em uso", () => {
    // Duas grades do mesmo tipo na mesma variação não têm representação: a
    // tabela do banco tem uma linha por grade.
    const drafts = [
      {
        key: "k1",
        values: [
          { gradeType: GRADE_TYPE.Model, value: "Com alça" },
          { gradeType: GRADE_TYPE.Color, value: "Azul" },
        ],
      } as VariationDraft,
    ];

    expect(trocarTipoDeGrade(drafts, GRADE_TYPE.Model, GRADE_TYPE.Color)).toBe(drafts);
  });
});

describe("aplicarGradesNasLinhas", () => {
  const gravada = (id: number, tamanho: string, barcode: string) =>
    ({
      id,
      key: `product-${id}`,
      barcode,
      price: 14.9,
      values: [{ gradeType: GRADE_TYPE.Size, value: tamanho }],
    }) as VariationDraft;

  it("grade nova entra como coluna EM BRANCO, sem criar nem apagar linha", () => {
    // O produto já tem venda: cruzar as grades obrigaria a chutar qual variação
    // fica com qual cor. A coluna entra vazia e o operador preenche na tabela.
    const atuais = [gravada(1, "10L", "2992110811678"), gravada(2, "6L", "7896725331443")];

    const depois = aplicarGradesNasLinhas(atuais, [GRADE_TYPE.Color, GRADE_TYPE.Size]);

    expect(depois).toHaveLength(2);
    expect(depois.map((draft) => draft.barcode)).toEqual(["2992110811678", "7896725331443"]);
    expect(depois.map((draft) => draft.values)).toEqual([
      [
        { gradeType: GRADE_TYPE.Color, value: "" },
        { gradeType: GRADE_TYPE.Size, value: "10L" },
      ],
      [
        { gradeType: GRADE_TYPE.Color, value: "" },
        { gradeType: GRADE_TYPE.Size, value: "6L" },
      ],
    ]);
  });

  it("a coluna em branco continua sendo uma grade do grupo", () => {
    // Se sumisse aqui, a coluna não seria desenhada e a validação do salvamento
    // não cobraria o preenchimento dela — a variação iria para o banco sem cor.
    const depois = aplicarGradesNasLinhas([gravada(1, "10L", "789")], [GRADE_TYPE.Color, GRADE_TYPE.Size]);

    expect(gradesDasVariacoes(depois)).toEqual([
      { type: GRADE_TYPE.Color, values: [] },
      { type: GRADE_TYPE.Size, values: ["10L"] },
    ]);
  });

  it("grade desmarcada perde a coluna, mas a variação continua", () => {
    const atuais = [
      {
        id: 1,
        key: "product-1",
        barcode: "789",
        values: [
          { gradeType: GRADE_TYPE.Color, value: "Azul" },
          { gradeType: GRADE_TYPE.Size, value: "G" },
        ],
      } as VariationDraft,
    ];

    const depois = aplicarGradesNasLinhas(atuais, [GRADE_TYPE.Size]);

    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe(1);
    expect(depois[0].values).toEqual([{ gradeType: GRADE_TYPE.Size, value: "G" }]);
  });

  it("ordena as colunas, não a ordem em que foram marcadas", () => {
    const depois = aplicarGradesNasLinhas(
      [gravada(1, "10L", "789")],
      [GRADE_TYPE.Model, GRADE_TYPE.Size, GRADE_TYPE.Color],
    );

    expect(depois[0].values.map((value) => value.gradeType)).toEqual([
      GRADE_TYPE.Color,
      GRADE_TYPE.Size,
      GRADE_TYPE.Model,
    ]);
  });
});
