import { describe, expect, it } from "vitest";
import { GRADE_TYPE } from "@workspace/api-client-react";
import { belowCostItems, salePriceLimitProblem, validateProductForm } from "../validateProductForm";
import type { ProductEditorForm, ProductGroupForm, VariationDraft } from "../../types";

function grupo(overrides: Partial<ProductGroupForm> = {}): ProductGroupForm {
  return {
    departmentId: "1",
    categoryId: "2",
    productGroupName: "COPO TÉRMICO",
    description: "",
    hasVariations: false,
    isPublic: true,
    ...overrides,
  };
}

function produto(overrides: Partial<ProductEditorForm> = {}): ProductEditorForm {
  return {
    id: 10,
    name: "COPO TÉRMICO",
    price: 39.9,
    stock: 0,
    minStock: 0,
    status: "2",
    tagIds: [],
    barcode: "",
    ...overrides,
  };
}

function variacao(overrides: Partial<VariationDraft> = {}): VariationDraft {
  return {
    ...produto(),
    key: "temp-abc",
    images: [],
    canDelete: true,
    values: [],
    ...overrides,
  };
}

describe("validateProductForm", () => {
  it("não reclama de um produto simples completo", () => {
    const { errors, firstErrorElementId } = validateProductForm({
      form: grupo(),
      productEditor: produto(),
      variationDrafts: [],
    });

    expect(errors).toEqual({});
    expect(firstErrorElementId).toBeNull();
  });

  it("aponta o PRIMEIRO campo vazio na ordem da tela", () => {
    // A ordem importa: o foco vai para o campo mais acima, senão a tela rola
    // para o fim do formulário e o operador não vê o que faltou.
    const { errors, firstErrorElementId } = validateProductForm({
      form: grupo({ productGroupName: "   ", departmentId: "" }),
      productEditor: produto(),
      variationDrafts: [],
    });

    expect(errors).toEqual({ name: true, department: true });
    expect(firstErrorElementId).toBe("input-name");
  });

  it("exige preço e status no produto simples", () => {
    const { errors, firstErrorElementId } = validateProductForm({
      form: grupo(),
      productEditor: produto({ price: 0, status: "" }),
      variationDrafts: [],
    });

    expect(errors).toEqual({ price: true, status: true });
    expect(firstErrorElementId).toBe("input-price");
  });

  it("ignora preço e status do grupo quando há variações", () => {
    // No grupo com variações quem tem preço é cada SKU. Validar o do grupo
    // travaria o salvamento num campo que a tela nem mostra.
    const { errors } = validateProductForm({
      form: grupo({ hasVariations: true }),
      productEditor: produto({ price: 0, status: "" }),
      variationDrafts: [variacao({ key: "product-1" })],
    });

    expect(errors).toEqual({});
  });

  it("marca cada variação incompleta pela chave da linha", () => {
    const { errors, firstErrorElementId } = validateProductForm({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [variacao({ key: "product-1" }), variacao({ key: "product-2", price: 0, status: "" })],
    });

    expect(errors).toEqual({
      "price-product-2": true,
      "status-product-2": true,
    });
    expect(firstErrorElementId).toBe("input-price-product-2");
  });

  it("NÃO valida o nome da variação — ele é derivado e a coluna é somente leitura", () => {
    // Regressão do salvar "que não responde": o draft nascia com o nome vazio
    // (grupo ainda sem nome no momento do toggle), a validação marcava um campo
    // que não existe mais na tela e o clique em Salvar não produzia nada visível.
    const { errors } = validateProductForm({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [variacao({ key: "product-1", name: "" }), variacao({ key: "product-2", name: "" })],
    });

    expect(errors).toEqual({});
  });

  it("exige valor em toda grade que o grupo usa, pintando a célula da linha", () => {
    // Se uma variação tem Cor e a outra não, as duas sairiam com o mesmo nome
    // composto. A chave `grade-<tipo>-<key>` é a que a tabela já pinta de
    // vermelho — antes desta validação o erro só aparecia como toast genérico.
    const { errors, firstErrorElementId } = validateProductForm({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [
        variacao({ key: "product-1", values: [{ gradeType: GRADE_TYPE.Color, value: "AZUL" }] }),
        variacao({ key: "product-2", values: [] }),
      ],
    });

    expect(errors).toEqual({ [`grade-${GRADE_TYPE.Color}-product-2`]: true });
    expect(firstErrorElementId).toBe(`input-grade-${GRADE_TYPE.Color}-product-2`);
  });
});

describe("marca em branco (22/10/2026)", () => {
  it("a variação sem marca passa — é como nasce a do código novo de um cadastro com venda", () => {
    const { errors } = validateProductForm({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [
        variacao({ key: "a", values: [{ gradeType: GRADE_TYPE.Brand, value: "M1" }] }),
        variacao({ key: "b", values: [] }),
      ],
    });

    expect(errors).toEqual({});
  });

  it("as outras grades continuam obrigatórias", () => {
    const { errors } = validateProductForm({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [
        variacao({ key: "a", values: [{ gradeType: GRADE_TYPE.Color, value: "AZUL" }] }),
        variacao({ key: "b", values: [{ gradeType: GRADE_TYPE.Color, value: "" }] }),
      ],
    });

    expect(errors).toEqual({ [`grade-${GRADE_TYPE.Color}-b`]: true });
  });
});

describe("salePriceLimitProblem — teto de R$ 30", () => {
  it("aponta o preço do produto simples acima do teto", () => {
    const problema = salePriceLimitProblem({
      form: grupo(),
      productEditor: produto({ price: 30.01 }),
      variationDrafts: [],
    });

    expect(problema?.errors).toEqual({ price: true });
    expect(problema?.message).toMatch(/teto da loja/);
  });

  it("aponta só as variações acima do teto, e o teto exato passa", () => {
    const problema = salePriceLimitProblem({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [variacao({ key: "a", price: 30 }), variacao({ key: "b", price: 35 })],
    });

    expect(problema?.errors).toEqual({ "price-b": true });
    expect(
      salePriceLimitProblem({ form: grupo(), productEditor: produto({ price: 30 }), variationDrafts: [] }),
    ).toBeNull();
  });
});

describe("belowCostItems — margem negativa pergunta antes", () => {
  it("produto simples com preço abaixo do último custo", () => {
    expect(
      belowCostItems({
        form: grupo(),
        productEditor: produto({ price: 20 }),
        variationDrafts: [],
        simpleCost: 22,
      }),
    ).toEqual(["COPO TÉRMICO"]);
    expect(
      belowCostItems({
        form: grupo(),
        productEditor: produto({ price: 25 }),
        variationDrafts: [],
        simpleCost: 22,
      }),
    ).toEqual([]);
    expect(
      belowCostItems({
        form: grupo(),
        productEditor: produto({ price: 20 }),
        variationDrafts: [],
        simpleCost: null,
      }),
    ).toEqual([]);
  });

  it("nas variações, só as gravadas com custo — a nova não tem custo para comparar", () => {
    const itens = belowCostItems({
      form: grupo({ hasVariations: true }),
      productEditor: produto(),
      variationDrafts: [
        variacao({
          key: "a",
          price: 20,
          costPrice: 25,
          values: [{ gradeType: GRADE_TYPE.Brand, value: "MASTER" }],
        }),
        variacao({ key: "b", price: 20, costPrice: 10 }),
        variacao({ key: "c", price: 5 }),
      ],
      simpleCost: null,
    });

    expect(itens).toEqual(["COPO TÉRMICO [MASTER]"]);
  });
});
