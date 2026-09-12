/**
 * Conferência de produtos (`/InventoryCounts`).
 *
 * A conferência é a varredura do catálogo para acertar foto, nome, preço,
 * variações e estoque físico, cadastro a cadastro. Só existe **uma aberta por
 * vez**, e ela se encerra sozinha quando o último item é conferido.
 *
 * O desenho completo está em `docs/conferencia-de-produtos.md`, no backend.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet, apiGetOrThrow, apiPost, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, EnumValue, QueryKey, UiPagedResult } from "../models";

/** Em que ponto está uma conferência. Chega como NOME (`"Open"`), não como número. */
export const INVENTORY_COUNT_STATUS = {
  None: 0,
  Open: 1,
  Finished: 2,
} as const;

/** A conferência e o quanto dela já foi feito. */
export interface InventoryCountDto {
  id: number;
  status: EnumValue;
  /** Rótulo pronto do servidor ("Em andamento", "Encerrada"). */
  statusName: string;
  startedAt: string;
  /** Ausente enquanto está em andamento. */
  finishedAt?: string | null;
  userId?: number | null;
  userName?: string | null;
  notes?: string | null;
  /**
   * Cadastros do snapshot que ainda existem. É CONTADO a cada leitura: cadastro
   * excluído no meio da conferência sai do denominador sozinho.
   */
  totalItems: number;
  reviewedItems: number;
  pendingItems: number;
}

/**
 * Uma linha da lista de conferência.
 *
 * Os campos do cadastro vêm **vivos** do banco — é o cadastro de agora que está
 * sendo corrigido. Do snapshot fica só `stockAtSnapshot`.
 */
export interface InventoryCountItemDto {
  id: number;
  /** Id do GRUPO — é ele que abre a tela de detalhe do produto. */
  productGroupId: number;
  /** Nome ATUAL do grupo. */
  productGroupName: string;
  categoryName?: string | null;
  /** Variações vivas. 1 em produto simples. */
  variationsCount: number;
  /** Variações sem foto nenhuma — o que a conferência quer zerar. */
  variationsWithoutImage: number;
  /** Caminho relativo da primeira foto; passe por `buildPublicImageUrl`. Ausente sem foto. */
  imageUrl?: string | null;
  /** Soma do estoque das variações vivas, agora. */
  stock: number;
  /** O mesmo valor no momento do snapshot. */
  stockAtSnapshot: number;
  /** Menor preço de venda entre as variações. */
  price: number;
  reviewed: boolean;
  reviewedAt?: string | null;
  reviewedByUserName?: string | null;
  stockAtReview?: number | null;
  notes?: string | null;
}

/** Situação de um cadastro na conferência aberta, para a tarja da tela de produto. */
export interface InventoryCountProductStateDto {
  itemId?: number | null;
  /** O cadastro faz parte da conferência aberta. */
  inCount: boolean;
  reviewed: boolean;
  reviewedAt?: string | null;
}

/** O que a contagem física lançou para o saldo virar o número contado. */
export interface StockCountResultDto {
  productId: number;
  productName: string;
  previousStock: number;
  countedStock: number;
  /** Contado menos anterior: positivo é sobra, negativo é falta, zero confere. */
  difference: number;
  /** Entrada de ajuste gerada pela sobra. Ausente quando não houve sobra. */
  purchaseEntryId?: number | null;
  /** Baixa de inventário gerada pela falta. Ausente quando não houve falta. */
  stockWriteOffId?: number | null;
}

/** Filtros da lista de conferência. */
export interface InventoryCountItemsParams {
  /** Mesma busca das demais telas de produto (nome, descrição, código, grade). */
  search?: string;
  categoryId?: number;
  /** `pending` (padrão), `reviewed` ou `all`. */
  status?: "pending" | "reviewed" | "all";
  /** Só cadastros com alguma variação sem foto. */
  onlyWithoutImage?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Prefixo do recurso. A conferência aberta, a lista e o estado de um produto
 * ficam todos SOB ele: marcar um item muda os três, e invalidar o prefixo
 * atualiza tudo de uma vez — a tarja do produto não pode discordar da lista.
 */
export const getGetInventoryCountsQueryKey = (): QueryKey => ["InventoryCounts"];

/** Chave da conferência aberta. */
export const getGetCurrentInventoryCountQueryKey = (): QueryKey => [
  ...getGetInventoryCountsQueryKey(),
  "current",
];

/** Chave da lista de itens. Quem consulta acrescenta os parâmetros ao prefixo. */
export const getGetInventoryCountItemsQueryKey = (): QueryKey => [
  ...getGetInventoryCountsQueryKey(),
  "items",
];

/** Chave da situação de um produto na conferência aberta. */
export const getGetInventoryCountProductStateQueryKey = (): QueryKey => [
  ...getGetInventoryCountsQueryKey(),
  "product-state",
];

/**
 * A conferência em andamento, ou `null` quando não há nenhuma.
 *
 * `apiGet` e não `apiGetOrThrow`: o backend responde **204** sem conferência
 * aberta, e isso é o estado inicial da tela — não um erro.
 */
export function useGetCurrentInventoryCount(options?: {
  query?: Omit<
    UseQueryOptions<InventoryCountDto | null, ApiError, InventoryCountDto | null, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<InventoryCountDto | null, ApiError, InventoryCountDto | null, QueryKey>({
    queryKey: getGetCurrentInventoryCountQueryKey(),
    queryFn: () => apiGet<InventoryCountDto>("/InventoryCounts/current"),
    ...options?.query,
  });
}

/** Página da lista de conferência. Sem `status`, o servidor devolve os pendentes. */
export function useGetInventoryCountItems(
  inventoryCountId: number | null | undefined,
  params?: InventoryCountItemsParams,
  options?: {
    query?: Omit<
      UseQueryOptions<
        UiPagedResult<InventoryCountItemDto>,
        ApiError,
        UiPagedResult<InventoryCountItemDto>,
        QueryKey
      >,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<
    UiPagedResult<InventoryCountItemDto>,
    ApiError,
    UiPagedResult<InventoryCountItemDto>,
    QueryKey
  >({
    queryKey: [...getGetInventoryCountItemsQueryKey(), inventoryCountId ?? 0, params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<InventoryCountItemDto>>(
        `/InventoryCounts/${inventoryCountId}/items`,
        {
          search: params?.search,
          categoryId: params?.categoryId,
          status: params?.status,
          onlyWithoutImage: params?.onlyWithoutImage ? true : undefined,
          page: params?.page ?? 1,
          size: params?.limit ?? 20,
        },
      );
      return mapPagedResult(result);
    },
    enabled: inventoryCountId != null && inventoryCountId > 0,
    ...options?.query,
  });
}

/**
 * Situação de um cadastro na conferência aberta.
 *
 * Usado pela tela de detalhe do produto. Sem conferência aberta a resposta vem
 * com `inCount: false` — não é erro, é o caso comum.
 */
export function useGetInventoryCountProductState(
  productGroupId: number | null | undefined,
  options?: {
    query?: Omit<
      UseQueryOptions<InventoryCountProductStateDto, ApiError, InventoryCountProductStateDto, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<InventoryCountProductStateDto, ApiError, InventoryCountProductStateDto, QueryKey>({
    queryKey: [...getGetInventoryCountProductStateQueryKey(), productGroupId ?? 0],
    queryFn: () =>
      apiGetOrThrow<InventoryCountProductStateDto>(`/InventoryCounts/current/products/${productGroupId}`),
    enabled: productGroupId != null && productGroupId > 0,
    ...options?.query,
  });
}

/** Abre uma conferência e tira o snapshot do catálogo. */
export async function startInventoryCount(notes?: string): Promise<InventoryCountDto> {
  const response = await apiPost<InventoryCountDto>("/InventoryCounts", { notes: notes ?? null });
  if (!response.data) throw new Error("Não foi possível abrir a conferência.");
  return response.data;
}

/**
 * Marca — ou desmarca — um cadastro na conferência aberta.
 *
 * A chave é o GRUPO porque quem chama são dois lugares: a lista da conferência
 * e a tela do produto, que conhece o grupo que está editando.
 *
 * Devolve a conferência já recontada — quando este foi o último pendente, ela
 * volta com `status: "Finished"`, e é assim que a tela sabe que acabou.
 */
export async function reviewInventoryCountProduct(
  productGroupId: number,
  reviewed = true,
  notes?: string,
): Promise<InventoryCountDto> {
  const response = await apiPost<InventoryCountDto>(
    `/InventoryCounts/current/products/${productGroupId}/review`,
    { reviewed, notes: notes ?? null },
  );
  if (!response.data) throw new Error("Não foi possível registrar a conferência do produto.");
  return response.data;
}

/** Encerra a conferência antes de conferir tudo. */
export async function finishInventoryCount(id: number): Promise<InventoryCountDto> {
  const response = await apiPost<InventoryCountDto>(`/InventoryCounts/${id}/finish`, {});
  if (!response.data) throw new Error("Não foi possível encerrar a conferência.");
  return response.data;
}

/**
 * Contagem física de uma variação: leva o saldo ao número contado, gerando
 * entrada de ajuste na sobra e baixa de inventário na falta.
 *
 * `supplierId` e `unitCost` só são usados quando SOBRA mercadoria — a sobra
 * vira lote, e lote sem custo envenena o FIFO. Omitidos, o servidor herda o
 * fornecedor do lote mais recente e o custo atual do produto.
 */
export async function registerStockCount(
  productId: number,
  input: {
    countedQuantity: number;
    supplierId?: number | null;
    unitCost?: number | null;
    notes?: string | null;
  },
): Promise<StockCountResultDto> {
  const response = await apiPost<StockCountResultDto>(`/InventoryCounts/products/${productId}/stock-count`, {
    countedQuantity: input.countedQuantity,
    supplierId: input.supplierId ?? null,
    unitCost: input.unitCost ?? null,
    notes: input.notes ?? null,
  });
  if (!response.data) throw new Error("Não foi possível registrar a contagem.");
  return response.data;
}
