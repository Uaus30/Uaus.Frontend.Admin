/**
 * Relatório de estoque baixo (`/LowStock`).
 *
 * A contagem tem hook próprio porque o painel e o topo da listagem de produtos
 * só precisam saber SE há pendência para acender o alerta vermelho — baixar a
 * lista a cada abertura do painel seria pagar pelo relatório sem abri-lo.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, ApiError, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  QueryKey,
  StockControlDisabledReason,
  StockForecastStatus,
  UiPagedResult,
} from "../models";

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
  /**
   * Cidade do mesmo fornecedor (14/10/2026) — é por ela que a Lista de Compras
   * agrupa a viagem. Omitida sem lote ou sem cidade no cadastro.
   */
  supplierCity?: string | null;
  /**
   * Quantidade da última ENTRADA DE COMPRA do produto (14/10/2026): o "comprei
   * 3" que explica por que um produto de atacado ficou fora do controle. Omitida
   * sem compra.
   */
  lastPurchaseQuantity?: number | null;
  /** Data dessa entrada, sem fuso (`yyyy-MM-ddT00:00:00`). Omitida sem compra. */
  lastPurchaseDate?: string | null;
  /** Caminho relativo da foto principal; passe por `buildPublicImageUrl`. Ausente sem foto. */
  imageUrl?: string | null;
  stock: number;
  /** Mínimo PRÓPRIO do produto; zero é "usa o padrão da loja". */
  minStock: number;
  /**
   * O mínimo que vale para o produto: o próprio, ou o padrão da loja. É o
   * número que a tela mostra ao lado do saldo.
   */
  effectiveMinStock: number;
  /** A chave do controle de estoque. */
  stockControlEnabled: boolean;
  /** Por que o controle foi desligado. Omitido com o controle ligado. */
  stockControlDisabledReason?: StockControlDisabledReason | null;
  /** Classificação da rotina diária. Omitida para quem a rotina ainda não viu. */
  forecastStatus?: StockForecastStatus | null;
  /** Mediana das vendas por mês. Omitida no produto novo. */
  monthlySalesMedian?: number | null;
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
   * Unidades por dia previstas pela rotina diária (média ponderada 3/2/1 dos
   * três últimos meses), com a precisão cheia. É o que decide quem entra no
   * relatório e em que ordem (29/09/2026; antes era a média simples de 90 dias).
   */
  dailyDemand: number;
  /** A mesma demanda arredondada em duas casas, para mostrar. */
  averageDailySales: number;
  /**
   * Por quantos dias o saldo deve durar na demanda prevista. Ausente sem giro:
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
   * Quantos produtos precisam de reposição — o MESMO número do relatório sem
   * filtro (29/09/2026). Até ali o alerta era um subconjunto; com o giro baixo
   * saindo do controle sozinho, dois números para a mesma pergunta só confundiam.
   *
   * Desde 14/10/2026 NÃO conta quem já tem compra **A caminho** (`InTransit`):
   * a mercadoria está vindo, e o alerta vermelho por ela só ensinava a ignorar
   * o alerta. É o mesmo critério do selo "Comprado" da listagem de produtos
   * (04/10/2026). Compra **Pendente** continua contando — é anotação de "preciso
   * comprar", o pedido ainda não saiu. É o mesmo número da aba "Para repor" sem
   * a caixa "Incluir os com compra a caminho".
   */
  restock: number;
  /**
   * Quantos precisam de reposição mas já têm compra A caminho (14/10/2026) — o
   * que ficou FORA de `restock`. Opcional por segurança de versão.
   */
  withPurchaseInTransit?: number;
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

/**
 * Qual lista: o que precisa de reposição (`Restock`, o padrão) ou o que está
 * fora do controle — desligado à mão ou ignorado por giro baixo — de onde se
 * religa (`OutOfControl`).
 *
 * `ShoppingList` (14/10/2026) é a Lista de Compras: os produtos com boa saída
 * que merecem reposição — os controlados que entrariam em `Restock` e também os
 * que ficaram fora do controle com o motivo `PlanTrip` —, filtráveis por
 * fornecedor ou pela cidade dele, para planejar a viagem ou o pedido.
 */
export type LowStockScope = "Restock" | "OutOfControl" | "ShoppingList";

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
  /** Qual lista. Ausente vale `Restock`. */
  scope?: LowStockScope;
  /** Só os produtos cujo lote mais recente é deste fornecedor (14/10/2026). */
  supplierId?: number;
  /**
   * Só os produtos de fornecedor desta cidade (14/10/2026). Vai como foi
   * mostrado no seletor: o backend compara sem acento e sem caixa.
   */
  city?: string;
  /**
   * Inclui quem já tem compra A caminho (14/10/2026). Ausente vale falso: em
   * `Restock` e `ShoppingList` quem tem mercadoria vindo fica fora da lista e
   * da contagem. A compra Pendente não tira ninguém — ela continua na lista,
   * com o "Compra em aberto" no lugar do botão (`hasOpenPurchase`).
   */
  includePurchasesInTransit?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Uma página do relatório, fora do React Query.
 *
 * É a mesma leitura do {@link useGetLowStock}; existe separada para a
 * exportação, que pede a lista inteira de uma vez com os filtros da tela. Antes
 * a exportação montava o `/LowStock` à mão na feature — o caminho do recurso
 * em dois lugares.
 */
export async function getLowStockPage(params?: LowStockParams): Promise<UiPagedResult<LowStockItemDto>> {
  const result = await apiGetOrThrow<BackendPagedResult<LowStockItemDto>>("/LowStock", {
    search: params?.search,
    maxStock: params?.maxStock,
    minRecentSales: params?.minRecentSales,
    sort: params?.sort,
    scope: params?.scope,
    supplierId: params?.supplierId,
    city: params?.city,
    includePurchasesInTransit: params?.includePurchasesInTransit,
    page: params?.page ?? 1,
    size: params?.limit ?? 20,
  });
  return mapPagedResult(result);
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
    queryFn: () => getLowStockPage(params),
    ...options?.query,
  });
}

/**
 * A contagem do alerta. Um minuto de `staleTime`: o alerta é
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
 * Desliga o controle de estoque do produto, com motivo opcional: ele sai do
 * relatório e do alerta sem sair do catálogo, e passa para a lista "Fora do
 * controle". O estoque mínimo não é tocado. Fica no histórico do produto.
 */
export async function disableStockControl(
  productId: number,
  reason?: StockControlDisabledReason | null,
): Promise<LowStockItemDto> {
  const response = await apiPost<LowStockItemDto>(`/LowStock/${productId}/disable-stock-control`, {
    reason: reason ?? null,
  });
  if (!response.data) throw new Error("Não foi possível desligar o controle de estoque.");
  return response.data;
}

/** Religa o controle de estoque do produto. Fica no histórico do produto. */
export async function enableStockControl(productId: number): Promise<LowStockItemDto> {
  const response = await apiPost<LowStockItemDto>(`/LowStock/${productId}/enable-stock-control`, {});
  if (!response.data) throw new Error("Não foi possível religar o controle de estoque.");
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
