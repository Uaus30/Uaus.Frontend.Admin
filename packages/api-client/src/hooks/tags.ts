/**
 * Etiquetas (tags) e o vínculo etiqueta × produto.
 *
 * Os caminhos `/Tags` e `/ProductTags` moravam em
 * `apps/admin/src/services/tags.service.ts`. Passaram para cá pela regra da
 * fronteira de dados: caminho, DTO e chave de cache nascem no api-client, e as
 * features consomem hook. O arquivo do admin virou reexport enquanto os
 * consumidores fora da feature de etiquetas não migram.
 */

import { useQuery, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import {
  apiGetOrThrow,
  apiPost,
  apiPut,
  apiDelete,
  ApiError,
  useCrudMutation,
  mapPagedResult,
  fetchAllPages,
} from "../client";
import type { BackendPagedResult, ProductTagDto, QueryKey, TagDto, UiPagedResult } from "../models";

/**
 * Etiqueta não tem payload em `models.ts` porque a escrita vivia no admin.
 * Deriva do DTO: `productCount` sai junto dos campos do servidor porque é
 * contagem calculada pela listagem, não algo que o cliente informe.
 */
export type CreateTagPayload = Omit<TagDto, "id" | "createdAt" | "updatedAt" | "productCount">;
export type UpdateTagPayload = CreateTagPayload;

/** Filtros da listagem paginada de etiquetas. */
export interface TagsPageParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const getGetTagsQueryKey = (): QueryKey => ["tags"];
export const getGetProductTagsQueryKey = (): QueryKey => ["product-tags"];

/**
 * Uma página de etiquetas.
 *
 * `limit` é o nome da UI; o servidor espera `size`. A tradução mora aqui para
 * nenhuma tela precisar conhecer o parâmetro do backend.
 */
export async function getTagsPage(params?: TagsPageParams) {
  const result = await apiGetOrThrow<BackendPagedResult<TagDto>>("/Tags", {
    search: params?.search,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
  return mapPagedResult(result);
}

/**
 * Busca de autocomplete: sempre a primeira página.
 *
 * É a mesma listagem, mas com a página fixa de propósito — um autocomplete que
 * herdasse a página corrente da tabela mostraria resultado vazio para um termo
 * que casa, e o operador concluiria que a etiqueta não existe e criaria a
 * duplicata.
 */
export async function searchTags(params?: { search?: string; limit?: number }) {
  return getTagsPage({ search: params?.search, page: 1, limit: params?.limit ?? 20 });
}

/** Catálogo completo de etiquetas, varrendo todas as páginas. */
export async function getAllTags() {
  return fetchAllPages<TagDto>("/Tags");
}

/** Catálogo completo dos vínculos etiqueta × produto. */
export async function getAllProductTags() {
  return fetchAllPages<ProductTagDto>("/ProductTags");
}

export function useGetTags(
  params?: TagsPageParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<TagDto>, ApiError, UiPagedResult<TagDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<TagDto>, ApiError, UiPagedResult<TagDto>, QueryKey>({
    queryKey: [...getGetTagsQueryKey(), params ?? {}],
    queryFn: () => getTagsPage(params),
    ...options?.query,
  });
}

/**
 * Cria a etiqueta e DEVOLVE a criada.
 *
 * Diferente das outras criações do pacote, que devolvem `null`: o seletor de
 * etiquetas do editor de produtos precisa do id recém-gerado para já vincular a
 * etiqueta ao produto na mesma interação. Corpo vazio aqui é falha do servidor,
 * não "criou sem retorno" — por isso lança em vez de devolver `null`, que
 * viraria `undefined.id` alguns quadros depois.
 *
 * O `trim` do nome fica aqui porque a etiqueta é criada de DOIS pontos da tela
 * (a tela de etiquetas e o autocomplete do editor de produtos); centralizar
 * evita que um deles grave " Promoção " e o outro "Promoção" como duas.
 */
export async function createTag(payload: CreateTagPayload) {
  const response = await apiPost<TagDto>("/Tags", {
    name: payload.name.trim(),
    color: payload.color,
    isPublic: payload.isPublic ?? false,
  });

  if (!response.data) {
    throw new ApiError("Não foi possível identificar a etiqueta criada.", 204, null, "POST", "/Tags");
  }

  return response.data;
}

/** Atualiza a etiqueta e devolve a versão gravada, pelo mesmo motivo de `createTag`. */
export async function updateTag(payload: UpdateTagPayload & { id: number }) {
  const response = await apiPut<TagDto>("/Tags", {
    id: payload.id,
    name: payload.name.trim(),
    color: payload.color,
    isPublic: payload.isPublic,
  });

  if (!response.data) {
    throw new ApiError("Não foi possível identificar a etiqueta atualizada.", 204, null, "PUT", "/Tags");
  }

  return response.data;
}

export async function deleteTag(id: number) {
  const response = await apiDelete<null>(`/Tags/${id}`);
  return response.data;
}

export function useCreateTag(options?: {
  mutation?: UseMutationOptions<TagDto, ApiError, { data: CreateTagPayload }>;
}) {
  return useCrudMutation(({ data }: { data: CreateTagPayload }) => createTag(data), options);
}

export function useUpdateTag(options?: {
  mutation?: UseMutationOptions<TagDto, ApiError, { id: number; data: UpdateTagPayload }>;
}) {
  return useCrudMutation(
    ({ id, data }: { id: number; data: UpdateTagPayload }) => updateTag({ id, ...data }),
    options,
  );
}

export function useDeleteTag(options?: { mutation?: UseMutationOptions<null, ApiError, { id: number }> }) {
  return useCrudMutation(({ id }: { id: number }) => deleteTag(id), options);
}
