/**
 * Relatório de estoque baixo (`/LowStock`).
 *
 * A contagem tem hook próprio porque o painel e o topo da listagem de produtos
 * só precisam saber SE há pendência para acender o alerta vermelho — baixar a
 * lista a cada abertura do painel seria pagar pelo relatório sem abri-lo.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, QueryKey, UiPagedResult } from "../models";

/** Uma linha do relatório: o produto, o saldo contra o mínimo e o estado do alerta. */
export interface LowStockItemDto {
  productId: number;
  /** Id do GRUPO — é ele que abre a tela de detalhe do produto. */
  productGroupId: number;
  /** Nome composto (grupo + grades). */
  productName: string;
  barcode: string;
  categoryName: string;
  /**
   * Fornecedor do lote mais recente. Ausente em produto sem lote: o backend
   * serializa com `WhenWritingNull`, então nulo chega como campo omitido.
   */
  supplierName?: string | null;
  /** Id do mesmo fornecedor — a compra de reposição abre já com ele escolhido. */
  supplierId?: number | null;
  /** Caminho relativo da foto principal; passe por `buildPublicImageUrl`. Ausente sem foto. */
  imageUrl?: string | null;
  stock: number;
  minStock: number;
  price: number;
  costPrice: number;
  /**
   * Última venda do produto (venda não cancelada), de toda a história. Ausente
   * em produto que nunca vendeu — o que separa "acabou porque gira" de "está
   * parado desde que entrou".
   */
  lastSaleAt?: string | null;
  /**
   * Unidades vendidas nos últimos 30 dias, sem as canceladas.
   *
   * É a coluna por onde o relatório filtra e ordena: separa "está acabando e
   * sai" de "está acabando e está parado desde sempre". Janela mais curta que a
   * da média de propósito — a média quer ritmo estável, esta quer saber se o
   * produto está saindo AGORA.
   */
  recentSales: number;
  /** Média de unidades vendidas por dia nos últimos 90 dias. Zero sem venda no período. */
  averageDailySales: number;
  /**
   * Por quantos dias o saldo deve durar no ritmo da janela. Ausente sem giro:
   * zero diria "acaba hoje" para um produto que não sai.
   */
  daysOfCover?: number | null;
  /**
   * Já existe compra Pendente ou A caminho deste produto. É o que decide o que
   * o botão "Resolver" faz: sem compra, ele leva ao registro do pedido.
   */
  hasOpenPurchase: boolean;
}

/** A contagem do alerta. */
export interface LowStockSummaryDto {
  /**
   * Produtos que **vendem e estão acabando** — o número do alerta.
   *
   * "Acabando" respeita o estoque mínimo de quem tem um e usa um teto para quem
   * não tem; "vende" é ter saída na janela de 30 dias. A contagem antiga
   * (`pending`) acendia o vermelho também para item parado há um ano, que não é
   * urgência de reposição.
   */
  restock: number;
  /** Mínimo de vendas usado em `restock` — a tela monta texto e filtro com ele. */
  restockMinSales: number;
}

/**
 * Prefixo do recurso. Lista e contagem ficam SOB ele de propósito: resolver um
 * item invalida o prefixo e as duas atualizam juntas — a tela do relatório e o
 * alerta do painel não podem discordar sobre quantos faltam.
 */
export const getGetLowStockQueryKey = (): QueryKey => ["low-stock"];

/** Chave da contagem. Quem consulta a lista acrescenta os parâmetros ao prefixo. */
export const getGetLowStockSummaryQueryKey = (): QueryKey => [...getGetLowStockQueryKey(), "summary"];

/**
 * Ordem da lista. Os nomes são os do enum do backend, que serializa por NOME.
 *
 * `Default` põe pendentes antes de resolvidos e, dentro do bloco, o menor saldo
 * primeiro; os outros dois ordenam pelas vendas dos últimos 30 dias.
 */
export type LowStockSort = "Default" | "RecentSalesDesc" | "RecentSalesAsc";

export interface LowStockParams {
  /** Mesma busca das demais telas de produto (nome, descrição, código, grade). */
  search?: string;
  /**
   * Teto de saldo: informado, o relatório lista todo produto vendável com
   * estoque MENOR que ele, **ignorando o estoque mínimo** — é a pergunta "o que
   * tem menos de 5 unidades?". Sem ele vale o padrão (mínimo configurado e
   * saldo igual ou abaixo dele), que é o que acende o alerta do painel.
   */
  maxStock?: number;
  /**
   * Mínimo de unidades vendidas nos últimos 30 dias. Como o teto de saldo, ele
   * também **ignora o estoque mínimo**: a pergunta que ele responde — "o que
   * está acabando e TEM saída?" — só faz sentido se alcançar os produtos sem
   * controle de estoque, que são os que o mínimo deixaria de fora.
   */
  minRecentSales?: number;
  /** Ordem da lista. Ausente vale `Default`. */
  sort?: LowStockSort;
  page?: number;
  limit?: number;
}

/** Página do relatório, do menor saldo para o maior. */
export function useGetLowStock(
  params?: LowStockParams,
  options?: {
    query?: Omit<
      UseQueryOptions<UiPagedResult<LowStockItemDto>, ApiError, UiPagedResult<LowStockItemDto>, QueryKey>,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<LowStockItemDto>, ApiError, UiPagedResult<LowStockItemDto>, QueryKey>({
    queryKey: [...getGetLowStockQueryKey(), "page", params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<LowStockItemDto>>("/LowStock", {
        search: params?.search,
        maxStock: params?.maxStock,
        minRecentSales: params?.minRecentSales,
        sort: params?.sort,
        page: params?.page ?? 1,
        size: params?.limit ?? 20,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/**
 * Contagem de pendentes e resolvidos. Um minuto de `staleTime`: o alerta é
 * lido no painel e na listagem de produtos, e o número muda com venda e
 * entrada — não a cada clique.
 */
export function useGetLowStockSummary(options?: {
  query?: Omit<
    UseQueryOptions<LowStockSummaryDto, ApiError, LowStockSummaryDto, QueryKey>,
    "queryKey" | "queryFn"
  >;
}) {
  return useQuery<LowStockSummaryDto, ApiError, LowStockSummaryDto, QueryKey>({
    queryKey: getGetLowStockSummaryQueryKey(),
    queryFn: () => apiGetOrThrow<LowStockSummaryDto>("/LowStock/summary"),
    staleTime: 60_000,
    ...options?.query,
  });
}

/**
 * Zera o estoque mínimo do produto: ele deixa de ser acompanhado e sai do
 * relatório e do alerta, sem sair do catálogo. Fica no histórico do produto.
 */
export async function disableStockControl(productId: number): Promise<LowStockItemDto> {
  const response = await apiPost<LowStockItemDto>(`/LowStock/${productId}/disable-stock-control`, {});
  if (!response.data) throw new Error("Não foi possível remover o controle de estoque.");
  return response.data;
}
