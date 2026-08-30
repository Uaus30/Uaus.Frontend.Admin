import { describe, expect, it } from "vitest";
import { validateProductForm } from "../validateProductForm";
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
      variationDrafts: [
        variacao({ key: "product-1" }),
        variacao({ key: "product-2", name: "", price: 0, status: "" }),
      ],
    });

    expect(errors).toEqual({
      "name-product-2": true,
      "price-product-2": true,
      "status-product-2": true,
    });
    expect(firstErrorElementId).toBe("input-name-product-2");
  });
});
