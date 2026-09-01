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

describe("generateVariationsMatrix", () => {
  it("acrescentar uma grade preserva as variações e preenche a coluna nova", async () => {
    // Regressão do relato de 01/09/2026: acrescentar "Cor: AZUL" a um produto
    // de "[10L]", "[6L]" e "[3,6L]" gerava três linhas novas com código de
    // barras vazio e preço zerado, e deixava as três originais órfãs na tela.
    const { view, estado } = renderVariations([
      gravada(1, "10L", "2992110811678"),
      gravada(2, "6L", "7896725331443"),
      gravada(3, "3,6L", "7896725329402"),
    ]);

    await act(async () => {
      await view.result.current.generateVariationsMatrix([
        { type: GRADE_TYPE.Color, values: ["AZUL"] },
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
    // A coluna que entrou vem preenchida: sem os valores do slot, a linha
    // ficaria sem Cor e o salvar recusaria por combinação repetida.
    expect(estado.drafts.map((draft) => draft.values)).toEqual([
      [
        { gradeType: GRADE_TYPE.Color, value: "AZUL" },
        { gradeType: GRADE_TYPE.Size, value: "10L" },
      ],
      [
        { gradeType: GRADE_TYPE.Color, value: "AZUL" },
        { gradeType: GRADE_TYPE.Size, value: "6L" },
      ],
      [
        { gradeType: GRADE_TYPE.Color, value: "AZUL" },
        { gradeType: GRADE_TYPE.Size, value: "3,6L" },
      ],
    ]);
    // Nenhuma variação saiu da matriz, então nada foi excluído no servidor.
    expect(mocks.deleteProduct).not.toHaveBeenCalled();
  });

  it("valor que saiu da matriz continua sendo excluído no servidor", async () => {
    mocks.deleteProduct.mockResolvedValue(undefined);
    const { view, estado } = renderVariations([
      gravada(1, "10L", "2992110811678"),
      gravada(2, "6L", "7896725331443"),
    ]);

    await act(async () => {
      await view.result.current.generateVariationsMatrix([{ type: GRADE_TYPE.Size, values: ["10L", "8L"] }]);
    });

    expect(mocks.deleteProduct).toHaveBeenCalledWith(2);
    expect(estado.drafts.map((draft) => draft.id)).toEqual([1, null]);
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
