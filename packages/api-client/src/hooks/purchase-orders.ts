/**
 * Compras a fornecedor (`/Purchases`) — o PEDIDO, do registro ao lançamento.
 *
 * Não confundir com `purchases.ts`, que é a ENTRADA (`/PurchaseEntries`, a nota
 * que já chegou e mexe no estoque). A compra vem antes; o recebimento dela é o
 * que gera a entrada.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiDelete, apiGetOrThrow, apiPost, apiPut, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, EnumValue, QueryKey, UiPagedResult } from "../models";

/** Foto da compra, já com a URL para a tela (passe por `buildPublicImageUrl`). */
export interface PurchaseImageDto {
  imageId: number;
  url: string;
  displayOrder: number;
}

/**
 * Uma compra. Os unitários e o percentual são DERIVADOS pelo backend dos totais
 * gravados — nunca são digitados, então não divergem do total.
 *
 * Os campos anuláveis são OPCIONAIS de propósito: o backend serializa com
 * `WhenWritingNull`, então um nulo chega como campo AUSENTE (`undefined`), não
 * como `null`. Compare com `== null`, nunca com `=== null` — foi assim que o
 * "Lançar recebimento" de produto novo abriu o diálogo de produto vinculado.
 */
export interface PurchaseDto {
  id: number;
  createdAt: string;
  updatedAt?: string | null;
  supplierId: number;
  supplierName: string;
  /** Produto vinculado (reposição). Ausente/nulo quando o produto ainda não existe. */
  productId?: number | null;
  /** Grupo do produto vinculado — é ele que abre a tela de detalhe do produto. */
  productGroupId?: number | null;
  productName: string;
  productBarcode?: string | null;
  details?: string | null;
  purchaseLink?: string | null;
  /**
   * Dia em que a compra foi feita, `yyyy-MM-ddT00:00:00` sem fuso. NÃO é
   * `createdAt`: o pedido costuma ser lançado no sistema depois de fechado, e é
   * esta data que a listagem ordena e exibe.
   */
  purchaseDate: string;
  quantity: number;
  grossTotal: number;
  finalTotal: number;
  /**
   * Preço de venda pretendido, decidido junto com a compra. Ausente quando não
   * foi informado — aí o recebimento mantém o preço atual do produto.
   */
  suggestedPrice?: number | null;
  /** Bruto ÷ quantidade. */
  unitGross: number;
  /** Final ÷ quantidade — o custo unitário que a entrada grava. */
  unitFinal: number;
  /** (Final − Bruto) ÷ Bruto em %. Negativo é desconto; positivo, acréscimo. */
  adjustmentPercent: number;
  /** Enum PurchaseStatus — chega como NOME; leia com `enumCode(valor, PURCHASE_STATUS)`. */
  status: EnumValue;
  receivedAt?: string | null;
  purchaseEntryId?: number | null;
  userName?: string | null;
  images: PurchaseImageDto[];
}

/** Cadastro e edição — o mesmo corpo, porque a edição é total. */
export interface SavePurchasePayload {
  supplierId: number;
  productId: number | null;
  /** Obrigatório sem `productId`; com produto vinculado o backend usa o nome do cadastro. */
  productName: string;
  details: string | null;
  purchaseLink: string | null;
  /** `yyyy-MM-ddT00:00:00`, sem fuso. Nulo é hoje. */
  purchaseDate: string | null;
  quantity: number;
  grossTotal: number;
  finalTotal: number;
  /** Preço de venda pretendido. Nulo mantém o preço atual do produto no recebimento. */
  suggestedPrice: number | null;
  /** Código de PurchaseStatus: Pendente (1) ou A caminho (2). */
  status: number;
  /** Ids de `images` já enviadas, na ordem de exibição. */
  imageIds: number[];
}

/** Recebimento de compra com produto vinculado. */
export interface ReceivePurchasePayload {
  /** `yyyy-MM-ddT00:00:00`, sem fuso. Nulo é hoje. */
  entryDate?: string | null;
  invoiceNumber?: string | null;
  notes?: string | null;
  /** Preço de venda a aplicar no cadastro. Nulo mantém o atual. */
  price?: number | null;
}

/** Fechamento de compra de produto NOVO, depois do cadastro e da entrada. */
export interface MarkPurchaseReceivedPayload {
  productId: number;
  purchaseEntryId?: number | null;
}

/**
 * Prefixo do recurso. A lista fica sob `["purchases", "page", params]` e o item
 * sob `["purchases", "item", id]`: invalidar o prefixo alcança os dois.
 */
export const getGetPurchasesQueryKey = (): QueryKey => ["purchases"];

export interface PurchasesParams {
  /** Código de PurchaseStatus. */
  status?: number;
  supplierId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

/** Página de compras, mais recentes primeiro. */
export function useGetPurchases(
  params?: PurchasesParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<PurchaseDto>, ApiError, UiPagedResult<PurchaseDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<PurchaseDto>, ApiError, UiPagedResult<PurchaseDto>, QueryKey>({
    queryKey: [...getGetPurchasesQueryKey(), "page", params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<PurchaseDto>>("/Purchases", {
        status: params?.status,
        supplierId: params?.supplierId,
        search: params?.search,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Uma compra pelo id. É o que a tela de produto usa para abrir o cadastro preenchido (`?compra=`). */
export function getPurchase(id: number): Promise<PurchaseDto> {
  return apiGetOrThrow<PurchaseDto>(`/Purchases/${id}`);
}

export async function createPurchase(payload: SavePurchasePayload): Promise<PurchaseDto> {
  const response = await apiPost<PurchaseDto>("/Purchases", payload);
  if (!response.data) throw new Error("Não foi possível registrar a compra.");
  return response.data;
}

export async function updatePurchase(id: number, payload: SavePurchasePayload): Promise<PurchaseDto> {
  const response = await apiPut<PurchaseDto>(`/Purchases/${id}`, payload);
  if (!response.data) throw new Error("Não foi possível atualizar a compra.");
  return response.data;
}

/** Pendente ↔ A caminho. "Lançado" só pelo recebimento. */
export async function updatePurchaseStatus(id: number, status: number): Promise<PurchaseDto> {
  const response = await apiPut<PurchaseDto>(`/Purchases/${id}/status`, { status });
  if (!response.data) throw new Error("Não foi possível alterar a situação da compra.");
  return response.data;
}

export async function deletePurchase(id: number): Promise<void> {
  await apiDelete<null>(`/Purchases/${id}`);
}

/**
 * Recebimento de compra com produto vinculado: o backend grava a entrada de
 * estoque com a quantidade e o custo da compra e marca como lançada, numa
 * transação. A chave de idempotência é da própria compra — repetir não duplica.
 */
export async function receivePurchase(id: number, payload: ReceivePurchasePayload): Promise<PurchaseDto> {
  const response = await apiPost<PurchaseDto>(`/Purchases/${id}/receive`, payload);
  if (!response.data) throw new Error("Não foi possível receber a compra.");
  return response.data;
}

/** Fecha uma compra de produto NOVO depois que o cadastro e a entrada foram feitos. */
export async function markPurchaseReceived(
  id: number,
  payload: MarkPurchaseReceivedPayload,
): Promise<PurchaseDto> {
  const response = await apiPost<PurchaseDto>(`/Purchases/${id}/mark-received`, payload);
  if (!response.data) throw new Error("Não foi possível lançar a compra.");
  return response.data;
}
