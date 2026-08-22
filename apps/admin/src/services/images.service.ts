import {
  apiDelete,
  apiGetBlob,
  apiGetOrThrow,
  apiPost,
  apiPut,
  buildUrl,
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

/**
 * Uma página do catálogo de imagens.
 *
 * O parâmetro chama `limit` aqui e vira `size` no query string porque essa é a
 * fronteira: **`size` é o nome do backend, `limit` é o nome do front**, e é a
 * mesma tradução que os hooks do `packages/api-client` fazem
 * (`useGetFixedCosts`, `useGetSales`...). Trocar `limit` por `size` na
 * assinatura pareceria mais simples e faria o admin voltar a ter dois nomes
 * para a mesma coisa no seu próprio código.
 *
 * O endpoint aceita apenas `search`, `page` e `size` — **não** filtra por tipo.
 * Quem precisa desse filtro carrega o catálogo inteiro e recorta no cliente;
 * ver `features/images/README.md`.
 */
export async function getImagesPage(params?: { search?: string; page?: number; limit?: number }) {
  return getPaged<ImageDto>("/Images", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
}

export async function createImageFromFile(payload: { file: File; name: string; type: number }) {
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
  const result = await apiGetOrThrow<ImageSearchResult[]>("/Images/search-internet", { q: query, limit });
  return result || [];
}

/**
 * Cria a URL de proxy para fazer download de uma imagem externa.
 */
export function buildImageProxyUrl(url: string): string {
  return buildUrl("/Images/proxy", { url });
}

/**
 * Baixa uma imagem da web pelo proxy do backend e a devolve como `File`.
 *
 * O proxy existe porque a imagem vem de domínio de terceiro e o navegador
 * bloquearia a leitura por CORS. Passa por `apiGetBlob` para o 401 cair no
 * tratamento central — os dois pontos que faziam isso montavam o header
 * `Authorization` na mão e ficavam de fora dele.
 *
 * @param webImageUrl URL pública da imagem escolhida na busca.
 * @param baseName Nome do produto, usado para batizar o arquivo.
 */
export async function downloadWebImageAsFile(webImageUrl: string, baseName: string): Promise<File> {
  const { blob } = await apiGetBlob("/Images/proxy", "imagem.jpg", {
    params: { url: webImageUrl },
  });
  const cleanName = baseName.toLowerCase().replace(/[^a-z0-9]/g, "_") || "produto";

  return new File([blob], `${cleanName}.jpg`, { type: blob.type });
}

