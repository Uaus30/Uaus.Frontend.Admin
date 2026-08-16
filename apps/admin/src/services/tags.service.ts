import {
  apiDelete,
  apiPost,
  apiPut,
  fetchAllPages,
  type ProductTagDto,
  type TagDto,
} from "@workspace/api-client-react";
import { getPaged } from "./core";

export async function getAllTags() {
  return fetchAllPages<TagDto>("/Tags");
}

export async function getAllProductTags() {
  return fetchAllPages<ProductTagDto>("/ProductTags");
}

export async function getTagsPage(params?: { search?: string; page?: number; limit?: number }) {
  return getPaged<TagDto>("/Tags", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function searchTags(params?: { search?: string; limit?: number }) {
  return getPaged<TagDto>("/Tags", {
    search: params?.search,
    page: 1,
    size: params?.limit ?? 20,
  });
}

export async function createTag(payload: { name: string; color: string; isPublic?: boolean }) {
  const response = await apiPost<TagDto>("/Tags", {
    name: payload.name.trim(),
    color: payload.color,
    isPublic: payload.isPublic ?? false,
  });

  if (!response.data) {
    throw new Error("Nao foi possivel identificar a etiqueta criada.");
  }

  return response.data;
}

export async function updateTag(payload: { id: number; name: string; color: string; isPublic: boolean }) {
  const response = await apiPut<TagDto>("/Tags", {
    id: payload.id,
    name: payload.name.trim(),
    color: payload.color,
    isPublic: payload.isPublic,
  });

  if (!response.data) {
    throw new Error("Nao foi possivel identificar a etiqueta atualizada.");
  }

  return response.data;
}

export async function deleteTag(id: number) {
  return apiDelete<null>(`/Tags/${id}`);
}
