import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  API_BASE_URL,
  fetchAllPages,
  type ImageDto,
  type ProductImageDto,
} from "@workspace/api-client-react";
import { getPaged } from "./core";

export async function getAllImages(params?: { search?: string }) {
  return fetchAllPages<ImageDto>("/Images", params);
}

export async function getAllProductImages() {
  return fetchAllPages<ProductImageDto>("/ProductImages");
}

export async function getImagesPage(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return getPaged<ImageDto>("/Images", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function createImageFromFile(payload: {
  file: File;
  name: string;
  type: number;
}) {
  const formData = new FormData();
  formData.append("File", payload.file);
  formData.append("Name", payload.name);
  formData.append("Type", String(payload.type));

  const result = await apiPost<ImageDto>("/Images", formData);
  return result.data as ImageDto;
}

export async function updateImageRecord(payload: {
  id: number;
  name: string;
  type: number;
  file?: File | null;
}) {
  const formData = new FormData();
  formData.append("Id", String(payload.id));
  formData.append("Name", payload.name);
  formData.append("Type", String(payload.type));
  if (payload.file) {
    formData.append("File", payload.file);
  }

  const result = await apiPut<ImageDto>("/Images", formData);
  return result.data as ImageDto;
}

export async function deleteImage(id: number) {
  return apiDelete<null>(`/Images/${id}`);
}

export interface ImageSearchResult {
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
}

/**
 * Busca imagens relacionadas a um termo na internet.
 */
export async function searchInternetImages(query: string, limit: number = 15): Promise<ImageSearchResult[]> {
  const result = await apiGet<ImageSearchResult[]>("/Images/search-internet", { q: query, limit });
  return result || [];
}

/**
 * Cria a URL de proxy para fazer download de uma imagem externa.
 */
export function buildImageProxyUrl(url: string): string {
  return `${API_BASE_URL}/Images/proxy?url=${encodeURIComponent(url)}`;
}
