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
function renderVariations(iniciais: VariationDraft[]) {
  const estado = { drafts: iniciais };

  const view = renderHook(() => {
    const [drafts, setDrafts] = React.useState(iniciais);
    estado.drafts = drafts;

    return useProductVariations({
      form: FORM,
      setForm: vi.fn(),
      productEditor: PRODUTO,
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

describe("applyGrades — produto já cadastrado", () => {
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

describe("applyGrades — cadastro começando do zero", () => {
  /** Draft ainda não salvo: é o que a tela cria ao marcar "tem variações". */
  const emBranco = (): VariationDraft => ({
    ...PRODUTO,
    key: "temp-1",
    name: FORM.productGroupName,
    images: [],
    canDelete: true,
    values: [],
  });

  it("cruza as grades e cria a matriz inteira", async () => {
    const { view, estado } = renderVariations([emBranco()]);

    await act(async () => {
      await view.result.current.applyGrades([
        { type: GRADE_TYPE.Color, values: ["AZUL", "ROSA"] },
        { type: GRADE_TYPE.Size, values: ["P", "G"] },
      ]);
    });

    expect(estado.drafts).toHaveLength(4);
    expect(estado.drafts.map((draft) => draft.values.map((value) => value.value).join("/"))).toEqual([
      "AZUL/P",
      "AZUL/G",
      "ROSA/P",
      "ROSA/G",
    ]);
    // Nada gravado ainda, nada a excluir no servidor.
    expect(mocks.deleteProduct).not.toHaveBeenCalled();
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
