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
  /**
   * Unidades vendidas nos últimos 90 dias, sem as canceladas.
   *
   * É a matéria-prima da média e da previsão de duração — e, por isso, de quem
   * entra no relatório e em que ordem. Vem na resposta porque a tela mostra a
   * conta inteira no título da coluna "Dura": só a média arredondada não
   * explica de onde saiu a previsão.
   */
  coverWindowSales: number;
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
   * Produtos que **venderam nos últimos 30 dias e estão esgotados ou acabam em
   * menos de trinta** — o número do alerta (12/09/2026).
   *
   * É sempre menor ou igual ao tamanho do relatório, que mostra também quem
   * atingiu o estoque mínimo e quem está acabando sem ter vendido no mês. Por
   * isso o alerta abre a lista sem filtro nenhum: o que ele conta está lá, no
   * topo, porque a lista ordena pelo que acaba antes.
   */
  restock: number;
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
 * `Default` é por **duração do saldo**, do que acaba antes para o que acaba
 * depois, com os esgotados na frente; os outros dois ordenam pelas vendas dos
 * últimos 30 dias.
 */
export type LowStockSort = "Default" | "RecentSalesDesc" | "RecentSalesAsc";

export interface LowStockParams {
  /** Mesma busca das demais telas de produto (nome, descrição, código, grade). */
  search?: string;
  /**
   * Teto de saldo: informado, **estreita** o relatório a quem tem estoque menor
   * que ele. Não abre o catálogo (12/09/2026) — produto que não precisa de
   * reposição continua fora, por menos saldo que tenha.
   */
  maxStock?: number;
  /**
   * Mínimo de unidades vendidas nos últimos 30 dias; também só estreita. É a
   * pergunta "dentro do que precisa de compra, o que realmente sai?".
   */
  minRecentSales?: number;
  /** Ordem da lista. Ausente vale `Default`. */
  sort?: LowStockSort;
  page?: number;
  limit?: number;
}

/** Página do relatório: esgotados primeiro, depois do que dura menos para o que dura mais. */
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

/**
 * Inativa o produto: ele sai do relatório, do alerta e da venda, sem sair do
 * catálogo — saldo, histórico e vendas passadas continuam onde estão.
 *
 * É a saída do que esgotou e não se quer repor. Não é exclusão, e nem poderia
 * ser: produto com venda registrada não pode ser excluído.
 */
export async function inactivateProduct(productId: number): Promise<LowStockItemDto> {
  const response = await apiPost<LowStockItemDto>(`/LowStock/${productId}/inactivate`, {});
  if (!response.data) throw new Error("Não foi possível inativar o produto.");
  return response.data;
}
