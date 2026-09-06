import {
  apiGetOrThrow,
  mapPagedResult,
  type BackendPagedResult,
  type EnumOptionDto,
} from "@workspace/api-client-react";
import { orderByName } from "@/lib/select-options";

/**
 * A montagem da URL pública de imagem mudou para o `@workspace/api-client-react`
 * quando o PDV passou a exibir miniatura na busca do balcão: os dois apps
 * precisam recolocar a MESMA base, e ela já mora lá. Continua saindo daqui
 * porque meia dúzia de telas do admin importam deste caminho.
 */
export { buildPublicImageUrl } from "@workspace/api-client-react";

/**
 * Opções de um enum do backend, **em ordem alfabética**.
 *
 * O backend devolve na ordem de declaração do enum (que espelha o número), e
 * todo select do admin mostra os itens em ordem alfabética — a regra e as
 * exceções estão em `lib/select-options.ts`. Ordenar aqui alcança de uma vez
 * os oito enums que alimentam select: status do produto, situação do
 * pagamento, tipo de log, tipo de imagem, papel e situação do usuário,
 * situação do fornecedor e tipo do histórico.
 *
 * Nenhum consumidor depende da ordem original: todos procuram por id.
 */
export async function getEnumOptions(path: string) {
  const options = await apiGetOrThrow<EnumOptionDto[]>(path, undefined, { auth: false });
  return orderByName(options, (option) => option.name);
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
