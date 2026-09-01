import {
  apiDelete,
  apiGetOrThrow,
  apiPost,
  apiPut,
  extractCreatedId,
  fetchAllPages,
  type ProductDto,
  type ProductGroupDto,
  type ProductImageDto,
  type ProductTagDto,
  type ProductVariationValueDto,
} from "@workspace/api-client-react";
import { getPaged } from "./core";

export async function getAllProductGroups(params?: { categoryId?: number }) {
  return fetchAllPages<ProductGroupDto>("/ProductGroups", params);
}

export async function getAllProducts(params?: { productGroupId?: number }) {
  return fetchAllPages<ProductDto>("/Products", params);
}

export async function getAllProductTags(params?: { productId?: number; tagId?: number }) {
  return fetchAllPages<ProductTagDto>("/ProductTags", params);
}

export async function getAllProductImages(params?: { productId?: number }) {
  return fetchAllPages<ProductImageDto>("/ProductImages", params);
}

export async function getProductsPage(params?: {
  search?: string;
  productGroupId?: number;
  page?: number;
  limit?: number;
}) {
  return getPaged<ProductDto>("/Products", {
    search: params?.search,
    productGroupId: params?.productGroupId,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function getProductGroupsPage(params?: {
  search?: string;
  categoryId?: number;
  page?: number;
  limit?: number;
}) {
  return getPaged<ProductGroupDto>("/ProductGroups", {
    search: params?.search,
    categoryId: params?.categoryId,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function createOrReuseProductGroup(payload: {
  categoryId: number;
  name: string;
  description?: string | null;
  hasVariations?: boolean;
  showOnSite?: boolean;
  existingGroups: ProductGroupDto[];
}) {
  const existing = payload.existingGroups.find(
    (item) =>
      item.categoryId === payload.categoryId &&
      item.name.trim().toLowerCase() === payload.name.trim().toLowerCase(),
  );

  if (existing) return existing;

  const response = await apiPost<ProductGroupDto>("/ProductGroups", {
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    hasVariations: payload.hasVariations ?? false,
    // Omitir o campo faria o backend desserializar false; o padrão do sistema é visível.
    showOnSite: payload.showOnSite ?? true,
  });

  if (response.data) {
    return response.data;
  }

  const createdId = extractCreatedId(response.response);
  if (!createdId) {
    throw new Error("Nao foi possivel identificar o grupo de produto criado.");
  }

  return {
    id: createdId,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    hasVariations: payload.hasVariations ?? false,
    showOnSite: payload.showOnSite ?? true,
    canDelete: true,
  } satisfies ProductGroupDto;
}

export async function createProductGroup(payload: {
  categoryId: number;
  name: string;
  description?: string | null;
  hasVariations: boolean;
  showOnSite?: boolean;
}) {
  const response = await apiPost<ProductGroupDto>("/ProductGroups", {
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    hasVariations: payload.hasVariations,
    showOnSite: payload.showOnSite ?? true,
  });

  if (response.data) {
    return response.data;
  }

  const createdId = extractCreatedId(response.response);
  if (!createdId) {
    throw new Error("Nao foi possivel identificar o grupo de produto criado.");
  }

  return {
    id: createdId,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    hasVariations: payload.hasVariations,
    showOnSite: payload.showOnSite ?? true,
    canDelete: true,
  } satisfies ProductGroupDto;
}

export async function updateProductGroup(payload: {
  id: number;
  categoryId: number;
  name: string;
  description?: string | null;
  hasVariations: boolean;
  showOnSite?: boolean;
}) {
  const response = await apiPut<ProductGroupDto>("/ProductGroups", {
    id: payload.id,
    categoryId: payload.categoryId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    hasVariations: payload.hasVariations,
    // O PUT do backend aplica o campo incondicionalmente: omitir desserializa
    // false e esconderia o grupo do site a cada salvamento.
    showOnSite: payload.showOnSite ?? true,
  });

  if (!response.data) {
    throw new Error("Nao foi possivel identificar o grupo de produto atualizado.");
  }

  return response.data;
}

export async function upsertProduct(payload: {
  id?: number | null;
  productGroupId: number;
  name: string;
  description?: string | null;
  barcode?: string;
  price: number;
  minStock?: number;
  status: number;
  variationValues?: Array<{ gradeType: number; value: string; displayOrder: number }>;
}) {
  // Sem costPrice nem stock de propósito: os requests do backend não têm esses
  // campos — custo e saldo nascem das entradas de estoque, nunca do cadastro.
  // Mandar `0` aqui era uma bomba armada para o dia em que alguém os adicionasse
  // ao request e o PUT passasse a zerar o estoque de quem edita preço.
  const request = {
    productGroupId: payload.productGroupId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    barcode: payload.barcode || null,
    price: payload.price,
    minStock: payload.minStock ?? 0,
    status: payload.status,
    variationValues: payload.variationValues ?? [],
  };

  if (payload.id) {
    const response = await apiPut<ProductDto>("/Products", {
      id: payload.id,
      ...request,
    });

    if (!response.data) {
      throw new Error("Nao foi possivel identificar o produto atualizado.");
    }

    return response.data;
  }

  const response = await apiPost<ProductDto>("/Products", request);
  if (response.data) {
    return response.data;
  }

  const createdId = extractCreatedId(response.response);
  if (!createdId) {
    throw new Error("Nao foi possivel identificar o produto criado.");
  }

  return {
    id: createdId,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    productGroupId: payload.productGroupId,
    name: payload.name.trim(),
    description: payload.description?.trim() || null,
    barcode: payload.barcode || "",
    price: payload.price,
    costPrice: 0,
    stock: 0,
    minStock: payload.minStock ?? 0,
    status: payload.status,
    canDelete: true,
    // Reconstrução local para o POST que não devolve corpo. O nome composto e
    // os valores de grade vêm do que acabou de ser enviado — a próxima leitura
    // do servidor traz a versão oficial.
    displayName: payload.name.trim(),
    variationValues: (payload.variationValues ?? []).map((value) => ({
      gradeType: value.gradeType as ProductVariationValueDto["gradeType"],
      value: value.value,
      displayOrder: value.displayOrder,
    })),
  } satisfies ProductDto;
}

export async function deleteProduct(id: number) {
  return apiDelete<null>(`/Products/${id}`);
}

export async function deleteProductGroup(id: number) {
  return apiDelete<null>(`/ProductGroups/${id}`);
}

export async function syncProductTags(payload: {
  productId: number;
  currentAssociations: ProductTagDto[];
  nextTagIds: number[];
}) {
  const currentTagIds = new Set(payload.currentAssociations.map((item) => item.tagId));
  const nextTagIds = new Set(payload.nextTagIds);

  const toCreate = payload.nextTagIds.filter((tagId) => !currentTagIds.has(tagId));
  const toDelete = payload.currentAssociations.filter((item) => !nextTagIds.has(item.tagId));

  for (const association of toDelete) {
    await apiDelete<null>(`/ProductTags/${association.id}`);
  }

  for (const tagId of toCreate) {
    await apiPost<null>("/ProductTags", {
      productId: payload.productId,
      tagId,
    });
  }
}

export async function syncProductImages(payload: {
  productId: number;
  currentAssociations: ProductImageDto[];
  nextImages: Array<{ imageId: number; displayOrder: number }>;
}) {
  const currentByImageId = new Map(payload.currentAssociations.map((item) => [item.imageId, item]));
  const nextImageIds = new Set(payload.nextImages.map((item) => item.imageId));

  for (const association of payload.currentAssociations) {
    if (!nextImageIds.has(association.imageId)) {
      await apiDelete<null>(`/ProductImages/${association.id}`);
    }
  }

  for (const nextImage of payload.nextImages) {
    const existing = currentByImageId.get(nextImage.imageId);

    if (!existing) {
      await apiPost<null>("/ProductImages", {
        productId: payload.productId,
        imageId: nextImage.imageId,
        displayOrder: nextImage.displayOrder,
      });
      continue;
    }

    if (existing.displayOrder !== nextImage.displayOrder) {
      await apiPut<ProductImageDto>("/ProductImages", {
        id: existing.id,
        productId: existing.productId,
        imageId: existing.imageId,
        displayOrder: nextImage.displayOrder,
      });
    }
  }
}

export async function getProductGroupById(id: number) {
  return apiGetOrThrow<ProductGroupDto>(`/ProductGroups/${id}`);
}

export async function getProductById(id: number) {
  return apiGetOrThrow<ProductDto>(`/Products/${id}`);
}
