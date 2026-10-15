/**
 * Catálogo de divulgação (`/Catalogs`) — o sorteio dos produtos que o admin
 * desenha em banner e em PDF.
 *
 * O servidor sorteia com números que só ele vê (venda, dinheiro parado, dias de
 * loja) e devolve o card da vitrine pública. Aberto a qualquer usuário
 * autenticado, por isso nada aqui carrega custo ou saldo.
 */

import { useQuery } from "@tanstack/react-query";
import { apiGet, apiGetOrThrow, apiPost, ApiError } from "../client";
import { STALE_TIME } from "../query-client";
import type {
  CatalogDrawDto,
  CatalogPieceHistoryDto,
  CatalogPieceRegisteredDto,
  CatalogSearchItemDto,
  CatalogSelectionDto,
  CatalogThemeDto,
  QueryKey,
} from "../models";

/** Prefixo da lista de temas. */
export const getGetCatalogThemesQueryKey = (): QueryKey => ["catalog-themes"];

/** Os temas disponíveis e quantos cadastros cada um tem para sortear. */
export function getCatalogThemes(): Promise<CatalogThemeDto[]> {
  return apiGetOrThrow<CatalogThemeDto[]>("/Catalogs/themes");
}

/**
 * Lista de temas para o seletor da tela.
 *
 * `staleTime` de catálogo: a contagem muda com venda, entrada e cadastro, e um
 * tema que a tela ainda oferece com "12 produtos" não pode estar vazio há meia
 * hora.
 */
export function useGetCatalogThemes() {
  return useQuery<CatalogThemeDto[], ApiError>({
    queryKey: [...getGetCatalogThemesQueryKey()],
    queryFn: getCatalogThemes,
    staleTime: STALE_TIME.catalogo,
  });
}

/** Pedido de sorteio. Os enums vão como código numérico (`CATALOG_THEME`, `CATALOG_ROLE`). */
export interface CatalogDrawRequest {
  theme: number;
  /** Obrigatório no tema `Department`. */
  departmentId?: number;
  /** Quantos produtos a peça leva (1 a 40). */
  count: number;
  /** Reservas, devolvidas à parte, para a foto que não carregar (0 a 12). */
  spare?: number;
  /** Sorteia só deste papel — é a troca de UM produto da peça. */
  role?: number;
  /** Cadastros que não podem sair: os que já estão na peça e os já recusados. */
  excludeGroupIds?: number[];
  /** Só cadastros de foto grande: é o sorteio do catálogo em PDF, de card grande. */
  largePhotosOnly?: boolean;
  /** Sem valor, o servidor escolhe a semente e a devolve. */
  seed?: number;
}

/**
 * Sorteia os produtos de uma peça.
 *
 * Função, e não hook de query: cada chamada dá um resultado diferente de
 * propósito, e guardar isso em cache faria o "sortear de novo" devolver a mesma
 * peça. Quem chama é o hook da feature.
 */
export async function drawCatalog(request: CatalogDrawRequest): Promise<CatalogDrawDto> {
  const response = await apiPost<CatalogDrawDto>("/Catalogs/draw", request);
  if (!response.data) {
    throw new ApiError("O sorteio do catálogo veio sem conteúdo.", 204, null, "POST", "/Catalogs/draw");
  }
  return response.data;
}

/**
 * Busca de cadastros para a peça personalizada, pelo nome ou pelo código de
 * barras (a regra de busca do balcão). Devolve também quem não pode entrar, com
 * o motivo.
 *
 * @param term Termo digitado. Vazio devolve lista vazia sem ir à rede — o
 *   servidor responderia o mesmo.
 * @param limit Máximo de resultados (padrão 20; o servidor limita a 50).
 */
export async function searchCatalogProducts(term: string, limit = 20): Promise<CatalogSearchItemDto[]> {
  const query = term.trim();
  if (!query) return [];

  return (await apiGet<CatalogSearchItemDto[]>("/Catalogs/products", { term: query, limit })) ?? [];
}

/** Prefixo da busca da peça personalizada. Quem consulta acrescenta termo e teto. */
export const getSearchCatalogProductsQueryKey = (): QueryKey => ["catalog-products-search"];

/**
 * A busca da peça personalizada, como query. Desligada com termo vazio: nenhuma
 * requisição sai sem termo.
 *
 * `staleTime` de operação: o motivo de não poder entrar ("sem saldo") muda com a
 * venda do balcão.
 */
export function useSearchCatalogProducts(term: string, limit = 20) {
  const query = term.trim();
  return useQuery<CatalogSearchItemDto[], ApiError>({
    queryKey: [...getSearchCatalogProductsQueryKey(), query, limit],
    queryFn: () => searchCatalogProducts(query, limit),
    enabled: query.length > 0,
    staleTime: STALE_TIME.operacao,
  });
}

/**
 * O card de agora e o papel de cada cadastro escolhido à mão, na ordem pedida,
 * e à parte quem já não pode entrar.
 *
 * Função, e não hook de query, pelo mesmo motivo do sorteio: o preço vai
 * IMPRESSO na peça e tem de ser o do instante em que ela é gerada.
 */
export async function getCatalogSelection(productGroupIds: number[]): Promise<CatalogSelectionDto> {
  const response = await apiPost<CatalogSelectionDto>("/Catalogs/selection", { productGroupIds });
  if (!response.data) {
    throw new ApiError("A seleção do catálogo veio sem conteúdo.", 204, null, "POST", "/Catalogs/selection");
  }
  return response.data;
}

/** Uma peça que saiu do admin. Os enums vão como código numérico. */
export interface RegisterCatalogPieceRequest {
  /** Chave gerada pelo navegador para ESTA peça: repetir o envio não cria outro registro. */
  clientKey: string;
  theme: number;
  /** Obrigatório no tema `Department`. */
  departmentId?: number;
  /** Código de `CATALOG_FORMAT`. */
  format: number;
  /** O título impresso no cabeçalho. */
  title: string;
  /** Os produtos, na ordem em que foram desenhados, com o preço impresso. */
  items: Array<{ productGroupId: number; role: number; price: number }>;
}

/**
 * Registra a peça que foi compartilhada ou baixada.
 *
 * É este registro que faz o sorteio seguinte evitar os mesmos produtos, e que
 * alimenta o histórico. Aberto a qualquer usuário autenticado, como o sorteio.
 */
export async function registerCatalogPiece(
  request: RegisterCatalogPieceRequest,
): Promise<CatalogPieceRegisteredDto> {
  const response = await apiPost<CatalogPieceRegisteredDto>("/Catalogs/pieces", request);
  if (!response.data) {
    throw new ApiError("O registro da peça veio sem conteúdo.", 204, null, "POST", "/Catalogs/pieces");
  }
  return response.data;
}

/** Prefixo do histórico de peças. Quem consulta acrescenta a quantidade. */
export const getGetCatalogPiecesQueryKey = (): QueryKey => ["catalog-pieces"];

/** As últimas peças que saíram, com a venda antes e depois. Só Admin. */
export function getCatalogPieces(take: number): Promise<CatalogPieceHistoryDto> {
  return apiGetOrThrow<CatalogPieceHistoryDto>("/Catalogs/pieces", { take });
}

/**
 * O histórico das peças.
 *
 * `staleTime` de operação: o "depois" de uma peça cresce a cada venda, e quem
 * abre a tela quer o número de agora.
 */
export function useGetCatalogPieces(take = 30) {
  return useQuery<CatalogPieceHistoryDto, ApiError>({
    queryKey: [...getGetCatalogPiecesQueryKey(), take],
    queryFn: () => getCatalogPieces(take),
    staleTime: STALE_TIME.operacao,
  });
}
