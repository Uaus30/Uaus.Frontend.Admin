import {
  apiGetOrThrow,
  mapPagedResult,
  type BackendPagedResult,
  type EnumOptionDto,
} from "@workspace/api-client-react";

/**
 * A montagem da URL pública de imagem mudou para o `@workspace/api-client-react`
 * quando o PDV passou a exibir miniatura na busca do balcão: os dois apps
 * precisam recolocar a MESMA base, e ela já mora lá. Continua saindo daqui
 * porque meia dúzia de telas do admin importam deste caminho.
 */
export { buildPublicImageUrl } from "@workspace/api-client-react";

export async function getEnumOptions(path: string) {
  return apiGetOrThrow<EnumOptionDto[]>(path, undefined, { auth: false });
}

export async function getPaged<T>(path: string, params?: Record<string, unknown>) {
  const result = await apiGetOrThrow<BackendPagedResult<T>>(path, params);
  return mapPagedResult(result);
}

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}
