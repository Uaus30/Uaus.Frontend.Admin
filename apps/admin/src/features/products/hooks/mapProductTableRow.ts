import type { ProductImageDto, ProductTableRowDto } from "@workspace/api-client-react";

import type { ProductTableRow } from "../types";

/**
 * Traduz a linha que o servidor devolve (`GET /Products/table`) para a linha que
 * a tela usa.
 *
 * É uma tradução, não uma montagem: todo campo daqui já veio pronto do servidor.
 * A função existe só para dar nome de tela ao que o backend nomeia por domínio —
 * `productGroupName` vira `name` porque é o nome que a tabela exibe, e o nome do
 * produto vai para `productName`, que é o que a edição inline devolve no PUT.
 *
 * Sem essa separação a edição rápida de preço renomearia o produto para o nome do
 * grupo, com registro no histórico. Já aconteceu.
 */
export function mapProductTableRow(row: ProductTableRowDto): ProductTableRow {
  return {
    id: row.productId,
    productGroupId: row.productGroupId,
    name: row.productGroupName,
    productName: row.productName,
    description: row.productDescription ?? null,
    barcode: row.barcode,
    price: row.price,
    costPrice: row.costPrice,
    stock: row.stock,
    minStock: row.minStock,
    status: row.status,
    variationCount: row.variationCount,
    productGroup: {
      id: row.productGroupId,
      name: row.productGroupName,
      description: row.productGroupDescription ?? null,
      hasVariations: row.hasVariations,
      showOnSite: row.showOnSite,
    },
    category: { id: row.categoryId, name: row.categoryName },
    department: { id: row.departmentId, name: row.departmentName },
    tags: (row.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    images: (row.images ?? []).map((image) => ({
      associationId: image.associationId,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt ?? null,
      imageId: image.imageId,
      displayOrder: image.displayOrder,
      image: {
        id: image.imageId,
        name: image.name,
        url: image.url,
      },
    })),
  };
}

/**
 * Reconstrói as associações de imagem no formato que o `syncProductImages`
 * consome.
 *
 * A sincronização precisa do id da ASSOCIAÇÃO para reordenar e remover sem tocar
 * no arquivo. Antes esses objetos vinham de `/ProductImages?productId=` — uma
 * requisição por produto da página. Agora vêm da própria linha, e esta função só
 * remonta o formato.
 */
export function toProductImageAssociations(row: ProductTableRow): ProductImageDto[] {
  return row.images.map((image) => ({
    id: image.associationId,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
    productId: row.id,
    imageId: image.imageId,
    displayOrder: image.displayOrder,
  }));
}
