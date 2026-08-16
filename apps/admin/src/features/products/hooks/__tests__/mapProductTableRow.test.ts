import { describe, expect, it } from "vitest";
import type { ProductTableRowDto } from "@workspace/api-client-react";

import { mapProductTableRow, toProductImageAssociations } from "../mapProductTableRow";

/**
 * Tradução da linha do servidor para a linha da tela.
 *
 * O que está sendo protegido é a separação entre o nome do GRUPO e o nome do
 * PRODUTO. A tabela exibe o nome do grupo; a edição rápida de preço faz PUT no
 * produto. Colapsar os dois num campo só compila, roda, e renomeia o produto a
 * cada correção de preço — com registro no histórico, e o nome errado vazando
 * para o cupom e para o PDV.
 */

/** Grupo "Caneca Personalizada" cujo representante se chama "Caneca 300ml". */
const linha: ProductTableRowDto = {
  productGroupId: 1,
  productGroupName: "Caneca Personalizada",
  productGroupDescription: "Porcelana",
  hasVariations: true,
  showOnSite: true,
  createdAt: "2026-01-01T00:00:00",
  updatedAt: null,
  categoryId: 5,
  categoryName: "Presentes",
  departmentId: 3,
  departmentName: "Papelaria",
  productId: 10,
  productName: "Caneca 300ml",
  productDescription: "Caneca de porcelana",
  barcode: "789000000001",
  price: 25,
  costPrice: 10,
  stock: 5,
  minStock: 1,
  status: 2,
  variationCount: 3,
  tags: [{ id: 4, name: "Promoção", color: "#ff0000" }],
  images: [
    {
      associationId: 77,
      createdAt: "2026-01-02T00:00:00",
      updatedAt: null,
      imageId: 88,
      displayOrder: 0,
      name: "frente",
      url: "https://cdn/frente.jpg",
    },
    {
      associationId: 78,
      createdAt: "2026-01-03T00:00:00",
      updatedAt: null,
      imageId: 89,
      displayOrder: 1,
      name: "verso",
      url: "https://cdn/verso.jpg",
    },
  ],
};

describe("mapProductTableRow", () => {
  it("exibe o nome do grupo e guarda o nome do produto à parte", () => {
    const row = mapProductTableRow(linha);

    expect(row.name).toBe("Caneca Personalizada");
    expect(row.productName).toBe("Caneca 300ml");
    expect(row.productGroup.name).toBe("Caneca Personalizada");
  });

  it("usa o id do PRODUTO representante como id da linha", () => {
    // A edição inline e o link direto do PDV endereçam o produto, não o grupo.
    const row = mapProductTableRow(linha);

    expect(row.id).toBe(10);
    expect(row.productGroupId).toBe(1);
  });

  it("preserva categoria, departamento e etiquetas já resolvidos", () => {
    const row = mapProductTableRow(linha);

    expect(row.category).toEqual({ id: 5, name: "Presentes" });
    expect(row.department).toEqual({ id: 3, name: "Papelaria" });
    expect(row.tags).toEqual([{ id: 4, name: "Promoção", color: "#ff0000" }]);
  });

  it("mantém a ordem de exibição das imagens, com a principal primeiro", () => {
    const row = mapProductTableRow(linha);

    expect(row.images.map((image) => image.imageId)).toEqual([88, 89]);
    expect(row.images[0].image).toEqual({ id: 88, name: "frente", url: "https://cdn/frente.jpg" });
  });

  it("normaliza os campos que o backend omite quando são nulos", () => {
    // O backend serializa com `WhenWritingNull`: campo nulo não chega como null,
    // chega ausente. Deixar `undefined` vazar faria a modal de edição abrir com
    // "undefined" escrito na descrição.
    const row = mapProductTableRow({
      ...linha,
      productDescription: undefined,
      productGroupDescription: undefined,
    });

    expect(row.description).toBeNull();
    expect(row.productGroup.description).toBeNull();
  });

  it("sobrevive ao grupo que ainda não tem produto", () => {
    // O grupo é criado antes do primeiro produto; a linha aparece zerada.
    const row = mapProductTableRow({
      ...linha,
      productId: 0,
      productName: "Caneca Personalizada",
      variationCount: 0,
      tags: [],
      images: [],
    });

    expect(row.id).toBe(0);
    expect(row.tags).toEqual([]);
    expect(row.images).toEqual([]);
  });
});

describe("toProductImageAssociations", () => {
  it("remonta as associações com o id da ASSOCIAÇÃO, não o da imagem", () => {
    // O `syncProductImages` remove e reordena pelo id da associação. Passar o id
    // da imagem apagaria a associação errada — ou nenhuma, e a sincronização
    // duplicaria o que já existe.
    const associations = toProductImageAssociations(mapProductTableRow(linha));

    expect(associations).toEqual([
      {
        id: 77,
        createdAt: "2026-01-02T00:00:00",
        updatedAt: null,
        productId: 10,
        imageId: 88,
        displayOrder: 0,
      },
      {
        id: 78,
        createdAt: "2026-01-03T00:00:00",
        updatedAt: null,
        productId: 10,
        imageId: 89,
        displayOrder: 1,
      },
    ]);
  });
});
