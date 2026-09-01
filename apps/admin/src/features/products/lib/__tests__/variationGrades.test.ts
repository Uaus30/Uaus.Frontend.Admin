import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import {
  aplicarGradesNasLinhas,
  gradesDasVariacoes,
  juntarValoresDeGrade,
  ordenarGrades,
  separarValoresDeGrade,
  temVariacaoSalva,
  trocarTipoDeGrade,
} from "../variationGrades";
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

describe("separarValoresDeGrade", () => {
  it("um valor por linha, sem repetido nem vazio", () => {
    expect(separarValoresDeGrade(" 10L \n\n6L\n10l ")).toEqual(["10L", "6L"]);
  });

  it("mantém a vírgula decimal dentro do valor", () => {
    // Regressão: com vírgula como separador, "10L, 6L, 3,6L" virava "10L",
    // "6L", "3" e "6L" — o repetido caía fora e a variação "[3,6L]", que tinha
    // código de barras e venda, sumia da matriz.
    expect(separarValoresDeGrade("10L\n6L\n3,6L")).toEqual(["10L", "6L", "3,6L"]);
  });

  it("vai e volta sem perder valor", () => {
    const valores = ["3,6L", "1,5L", "10L"];

    expect(separarValoresDeGrade(juntarValoresDeGrade(valores))).toEqual(valores);
  });
});

describe("trocarTipoDeGrade", () => {
  const comGrade = (type: number, value: string) =>
    ({ key: `k-${value}`, values: [{ gradeType: type, value }] }) as VariationDraft;

  it("renomeia a grade em todas as variações, sem tocar nos valores", () => {
    // É a correção da importação do sistema anterior: o valor é uma cor, mas a
    // grade veio como "Modelo". Trocar pela modal geraria combinações sem grade
    // em comum com as atuais, e as variações com código de barras iriam para a
    // exclusão.
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

describe("temVariacaoSalva", () => {
  it("distingue cadastro começando do zero de produto já gravado", () => {
    // É este critério que escolhe entre gerar a matriz e só mexer em coluna.
    const novo = [{ id: null, values: [] }] as unknown as VariationDraft[];
    const gravado = [{ id: 42, values: [] }] as unknown as VariationDraft[];

    expect(temVariacaoSalva(novo)).toBe(false);
    expect(temVariacaoSalva(gravado)).toBe(true);
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
