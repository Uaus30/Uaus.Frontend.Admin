import {
  apiGetOrThrow,
  API_BASE_URL,
  mapPagedResult,
  type BackendPagedResult,
  type EnumOptionDto,
} from "@workspace/api-client-react";

export async function getEnumOptions(path: string) {
  return apiGetOrThrow<EnumOptionDto[]>(path, undefined, { auth: false });
}

export async function getPaged<T>(path: string, params?: Record<string, unknown>) {
  const result = await apiGetOrThrow<BackendPagedResult<T>>(path, params);
  return mapPagedResult(result);
}

export function buildPublicImageUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
}

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
