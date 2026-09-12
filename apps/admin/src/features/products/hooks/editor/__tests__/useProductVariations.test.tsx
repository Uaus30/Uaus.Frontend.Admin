import React from "react";
import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import type { ProductEditorForm, ProductGroupForm, VariationDraft } from "../../../types";

const mocks = vi.hoisted(() => ({ deleteProduct: vi.fn() }));

vi.mock("@/services/products.service", () => ({
  deleteProduct: mocks.deleteProduct,
}));

const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

const { useProductVariations } = await import("../useProductVariations");

const FORM: ProductGroupForm = {
  departmentId: "3",
  categoryId: "9",
  productGroupName: "BACIA COM TAMPA TRITEC",
  description: "",
  hasVariations: true,
  isPublic: true,
};

const PRODUTO: ProductEditorForm = {
  id: null,
  name: "",
  description: "",
  price: 0,
  stock: 0,
  minStock: 0,
  status: "2",
  tagIds: [],
  barcode: "",
};

/** Uma variação já gravada, com o código de barras que veio da etiqueta. */
function gravada(id: number, tamanho: string, barcode: string): VariationDraft {
  return {
    ...PRODUTO,
    id,
    key: `product-${id}`,
    name: FORM.productGroupName,
    barcode,
    price: 14.9,
    status: "2",
    images: [],
    canDelete: true,
    values: [{ gradeType: GRADE_TYPE.Size, value: tamanho }],
  };
}

/**
 * Renderiza o hook com o estado das variações de verdade — `setVariationDrafts`
 * precisa realimentar o hook, senão o teste afirmaria o que o próprio dublê
 * devolveu em vez do que a tela passa a mostrar.
 */
function renderVariations(iniciais: VariationDraft[], produto: ProductEditorForm = PRODUTO) {
  const estado = { drafts: iniciais };

  const view = renderHook(() => {
    const [drafts, setDrafts] = React.useState(iniciais);
    estado.drafts = drafts;

    return useProductVariations({
      form: FORM,
      setForm: vi.fn(),
      productEditor: produto,
      variationDrafts: drafts,
      setVariationDrafts: setDrafts,
      activeVariationKey: null,
      setActiveVariationKey: vi.fn(),
      defaultStatus: "2",
      editingGroupId: 5,
      invalidateProductQueries: vi.fn().mockResolvedValue(undefined),
      refetchGroupProducts: vi.fn().mockResolvedValue(undefined),
    });
  });

  return { view, estado };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyGrades — produto com a tabela já montada", () => {
  it("grade nova entra como coluna em branco, sem recriar as variações", () => {
    // Relato de 01/09/2026: acrescentar "Cor" a um produto de "[10L]", "[6L]" e
    // "[3,6L]" gerava três linhas novas com código de barras vazio e deixava as
    // três originais órfãs na tela. A modal deixou de cruzar grades em produto
    // gravado — a coluna entra vazia e o operador preenche na tabela.
    const { view, estado } = renderVariations([
      gravada(1, "10L", "2992110811678"),
      gravada(2, "6L", "7896725331443"),
      gravada(3, "3,6L", "7896725329402"),
    ]);

    act(() => {
      void view.result.current.applyGrades([
        { type: GRADE_TYPE.Color, values: [] },
        { type: GRADE_TYPE.Size, values: ["10L", "6L", "3,6L"] },
      ]);
    });

    expect(estado.drafts).toHaveLength(3);
    expect(estado.drafts.map((draft) => draft.id)).toEqual([1, 2, 3]);
    expect(estado.drafts.map((draft) => draft.barcode)).toEqual([
      "2992110811678",
      "7896725331443",
      "7896725329402",
    ]);
    expect(estado.drafts.map((draft) => draft.values)).toEqual([
      [
        { gradeType: GRADE_TYPE.Color, value: "" },
        { gradeType: GRADE_TYPE.Size, value: "10L" },
      ],
      [
        { gradeType: GRADE_TYPE.Color, value: "" },
        { gradeType: GRADE_TYPE.Size, value: "6L" },
      ],
      [
        { gradeType: GRADE_TYPE.Color, value: "" },
        { gradeType: GRADE_TYPE.Size, value: "3,6L" },
      ],
    ]);
    // Nenhuma linha sai do cadastro por aqui: o lixo da linha é o único caminho
    // de exclusão, e ele pede confirmação.
    expect(mocks.deleteProduct).not.toHaveBeenCalled();
  });

  it("desmarcar a grade tira a coluna sem excluir variação no servidor", () => {
    const { view, estado } = renderVariations([
      gravada(1, "10L", "2992110811678"),
      gravada(2, "6L", "7896725331443"),
    ]);

    act(() => {
      void view.result.current.applyGrades([{ type: GRADE_TYPE.Model, values: [] }]);
    });

    expect(estado.drafts).toHaveLength(2);
    expect(estado.drafts.map((draft) => draft.values)).toEqual([
      [{ gradeType: GRADE_TYPE.Model, value: "" }],
      [{ gradeType: GRADE_TYPE.Model, value: "" }],
    ]);
    expect(mocks.deleteProduct).not.toHaveBeenCalled();
  });

  it("a linha avulsa nasce com as colunas que a tabela já mostra", () => {
    // Sem isso ela ficaria sem as grades do grupo, a validação não cobraria
    // nada dela e o salvar aceitaria uma variação sem valor de grade.
    const { view, estado } = renderVariations([gravada(1, "10L", "2992110811678")]);

    act(() => {
      view.result.current.addVariationDraft();
    });

    expect(estado.drafts).toHaveLength(2);
    expect(estado.drafts[1].values).toEqual([{ gradeType: GRADE_TYPE.Size, value: "" }]);
  });
});

describe("applyGrades — produto que ainda não tem variação nenhuma", () => {
  /** O produto simples da tela: ele é quem vira a primeira variação. */
  const SALVO: ProductEditorForm = {
    id: 897,
    name: "CALCINHA INFANTIL LISA ALGODAO",
    description: "",
    price: 12.9,
    stock: 7,
    minStock: 2,
    status: "2",
    tagIds: [4],
    barcode: "7896725329402",
  };

  it("a tabela nasce com o PRÓPRIO produto e a coluna em branco", () => {
    // REGRESSÃO (produção, 12/09/2026 — produto 897): a modal pedia os valores
    // de cada grade, cruzava tudo e, no fim, a tela mostrava uma linha só, sem
    // coluna de grade, com o que tinha sido digitado descartado. Produto
    // simples salvo tem a tabela VAZIA — ele mora no `productEditor` —, então
    // o caminho do cruzamento gerava linhas novas que a carga do grupo pelo
    // servidor sobrescrevia em seguida.
    const { view, estado } = renderVariations([], SALVO);

    act(() => {
      view.result.current.applyGrades([{ type: GRADE_TYPE.Color, values: [] }]);
    });

    expect(estado.drafts).toHaveLength(1);
    // Com o id do produto: o salvar ATUALIZA o 897 em vez de criar um irmão e
    // deixar o original como variação sem grade no mesmo grupo.
    expect(estado.drafts[0].id).toBe(897);
    expect(estado.drafts[0].key).toBe("product-897");
    expect(estado.drafts[0].barcode).toBe("7896725329402");
    expect(estado.drafts[0].price).toBe(12.9);
    expect(estado.drafts[0].status).toBe("2");
    // O nome é o do GRUPO em toda variação; quem distingue são os valores.
    expect(estado.drafts[0].name).toBe(FORM.productGroupName);
    // Coluna vazia: o operador digita o valor na tabela, e a validação do
    // salvamento cobra o preenchimento.
    expect(estado.drafts[0].values).toEqual([{ gradeType: GRADE_TYPE.Color, value: "" }]);
    expect(mocks.deleteProduct).not.toHaveBeenCalled();
  });

  it("duas grades marcadas dão duas colunas — e continua uma linha só", () => {
    // O cruzamento saiu de vez: marcar Cor e Tamanho não gera combinação
    // nenhuma, gera duas colunas para preencher.
    const { view, estado } = renderVariations([], SALVO);

    act(() => {
      view.result.current.applyGrades([
        { type: GRADE_TYPE.Color, values: [] },
        { type: GRADE_TYPE.Size, values: [] },
      ]);
    });

    expect(estado.drafts).toHaveLength(1);
    expect(estado.drafts[0].values).toEqual([
      { gradeType: GRADE_TYPE.Color, value: "" },
      { gradeType: GRADE_TYPE.Size, value: "" },
    ]);
  });

  it("cadastro ainda não salvo nasce sem id, para o salvar criar o produto", () => {
    const { view, estado } = renderVariations([]);

    act(() => {
      view.result.current.applyGrades([{ type: GRADE_TYPE.Size, values: [] }]);
    });

    expect(estado.drafts).toHaveLength(1);
    expect(estado.drafts[0].id).toBeNull();
    expect(estado.drafts[0].key.startsWith("temp-")).toBe(true);
    expect(estado.drafts[0].values).toEqual([{ gradeType: GRADE_TYPE.Size, value: "" }]);
  });
});

describe("changeGradeType", () => {
  it("troca o tipo da coluna em todas as variações, mantendo id e código", () => {
    // A importação do sistema anterior trouxe produto com a grade "Modelo"
    // onde o valor é cor. Pela modal não dava para corrigir: as combinações de
    // "Cor" não têm grade em comum com as de "Modelo", e as variações com
    // código de barras iriam para a exclusão.
    const porModelo = [gravada(1, "Azul", "789"), gravada(2, "Preto", "790")].map((draft) => ({
      ...draft,
      values: [{ gradeType: GRADE_TYPE.Model, value: draft.values[0].value }],
    }));
    const { view, estado } = renderVariations(porModelo);

    act(() => {
      view.result.current.changeGradeType(GRADE_TYPE.Model, GRADE_TYPE.Color);
    });

    expect(estado.drafts.map((draft) => draft.values)).toEqual([
      [{ gradeType: GRADE_TYPE.Color, value: "Azul" }],
      [{ gradeType: GRADE_TYPE.Color, value: "Preto" }],
    ]);
    expect(estado.drafts.map((draft) => draft.id)).toEqual([1, 2]);
    expect(estado.drafts.map((draft) => draft.barcode)).toEqual(["789", "790"]);
  });
});
