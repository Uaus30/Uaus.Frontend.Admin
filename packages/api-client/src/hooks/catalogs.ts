/**
 * Catálogo de divulgação (`/Catalogs`) — o sorteio dos produtos que o admin
 * desenha em banner e em PDF.
 *
 * O servidor sorteia com números que só ele vê (venda, dinheiro parado, dias de
 * loja) e devolve o card da vitrine pública. Aberto a qualquer usuário
 * autenticado, por isso nada aqui carrega custo ou saldo.
 */

import { useQuery } from "@tanstack/react-query";
import { apiGetOrThrow, apiPost, ApiError } from "../client";
import { STALE_TIME } from "../query-client";
import type { CatalogDrawDto, CatalogThemeDto, QueryKey } from "../models";

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
