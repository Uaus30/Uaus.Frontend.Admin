/**
 * Vitrine pública do site (/Storefront) — os únicos endpoints ANÔNIMOS de dados.
 *
 * TODA chamada daqui vai com `{ auth: false }`, e isso não é otimização: além
 * de não anexar o header `Authorization`, o `auth: false` desliga o
 * redirecionamento global do 401 para `/login` — rota que o site público não
 * tem. Sem ele, uma sessão vencida esquecida no localStorage derrubaria o
 * visitante num 404.
 */

import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { apiGetOrThrow, ApiError, mapPagedResult } from "../client";
import { STALE_TIME } from "../query-client";
import type {
  BackendPagedResult,
  QueryKey,
  StorefrontCompanyDto,
  StorefrontProductDetailDto,
  StorefrontProductDto,
  UiPagedResult,
} from "../models";

/** Prefixo da listagem da vitrine. */
export const getGetStorefrontProductsQueryKey = (): QueryKey => ["storefront-products"];

/** Prefixo do detalhe de um grupo na vitrine. */
export const getGetStorefrontProductQueryKey = (): QueryKey => ["storefront-product"];

/** Prefixo da identidade da loja exibida no site. */
export const getGetStorefrontCompanyQueryKey = (): QueryKey => ["storefront-company"];

/** Filtros da página da vitrine. O `size` padrão (24) preenche a grade de 4 colunas. */
export interface StorefrontProductsPageParams {
  search?: string;
  page?: number;
  size?: number;
}

/** Uma página de cards da vitrine, sem autenticação. */
export async function getStorefrontProductsPage(
  params?: StorefrontProductsPageParams,
): Promise<UiPagedResult<StorefrontProductDto>> {
  const result = await apiGetOrThrow<BackendPagedResult<StorefrontProductDto>>(
    "/Storefront/products",
    {
      search: params?.search,
      page: params?.page ?? 1,
      size: params?.size ?? 24,
    },
    { auth: false },
  );
  return mapPagedResult(result);
}

/**
 * Próxima página do scroll infinito, ou `undefined` no fim.
 *
 * Exportada como função pura para o teste cobrir o encerramento — o bug
 * clássico de scroll infinito é pedir a página N+1 para sempre.
 */
export function getNextStorefrontPageParam(
  lastPage: UiPagedResult<StorefrontProductDto>,
): number | undefined {
  return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
}

/**
 * Listagem da vitrine com scroll infinito.
 *
 * `useInfiniteQuery` em vez de varredura completa (`fetchAllPages`) porque a
 * vitrine é pública: o visitante típico vê a primeira dúzia de produtos e vai
 * embora — baixar o catálogo inteiro no primeiro paint cobraria o custo de
 * todos por curiosidade de poucos. A busca vai ao servidor pelo mesmo motivo.
 */
export function useGetStorefrontProductsInfinite(
  params?: Omit<StorefrontProductsPageParams, "page">,
): UseInfiniteQueryResult<InfiniteData<UiPagedResult<StorefrontProductDto>>, ApiError> {
  return useInfiniteQuery<
    UiPagedResult<StorefrontProductDto>,
    ApiError,
    InfiniteData<UiPagedResult<StorefrontProductDto>>,
    QueryKey,
    number
  >({
    queryKey: [...getGetStorefrontProductsQueryKey(), params ?? {}],
    queryFn: ({ pageParam }) => getStorefrontProductsPage({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: getNextStorefrontPageParam,
    staleTime: STALE_TIME.catalogo,
  });
}

/** Prefixo de uma PÁGINA avulsa da vitrine — quem consulta acrescenta os filtros. */
export const getGetStorefrontProductsPageQueryKey = (): QueryKey => ["storefront-products-page"];

/**
 * Uma página só da vitrine, sem scroll infinito: a faixa de destaques da home,
 * que pede os primeiros N produtos e nada mais.
 *
 * Prefixo PRÓPRIO, e não o de `useGetStorefrontProductsInfinite`: as duas
 * guardam formatos diferentes no cache (`UiPagedResult` contra `InfiniteData`
 * de páginas), e dividir prefixo faria um `invalidateQueries` futuro derrubar
 * as duas esperando o mesmo shape.
 */
export function useGetStorefrontProducts(params?: StorefrontProductsPageParams) {
  return useQuery<UiPagedResult<StorefrontProductDto>, ApiError>({
    queryKey: [...getGetStorefrontProductsPageQueryKey(), params ?? {}],
    queryFn: () => getStorefrontProductsPage(params),
    staleTime: STALE_TIME.catalogo,
  });
}

/** Detalhe de um grupo exibível. 404 vira `ApiError` (sem redirect — anônimo). */
export function getStorefrontProduct(productGroupId: number): Promise<StorefrontProductDetailDto> {
  return apiGetOrThrow<StorefrontProductDetailDto>(`/Storefront/products/${productGroupId}`, undefined, {
    auth: false,
  });
}

/** Detalhe para a tela de produto. Desligado até o id chegar da rota. */
export function useGetStorefrontProduct(productGroupId: number) {
  return useQuery<StorefrontProductDetailDto, ApiError>({
    queryKey: [...getGetStorefrontProductQueryKey(), productGroupId],
    queryFn: () => getStorefrontProduct(productGroupId),
    enabled: Number.isFinite(productGroupId) && productGroupId > 0,
    staleTime: STALE_TIME.catalogo,
  });
}

/** Identidade da loja (nome, endereço, telefone) para rodapé e contato. */
export function getStorefrontCompany(): Promise<StorefrontCompanyDto> {
  return apiGetOrThrow<StorefrontCompanyDto>("/Storefront/company", undefined, { auth: false });
}

/** Identidade da loja com cadência de referência — muda quando o admin edita. */
export function useGetStorefrontCompany() {
  return useQuery<StorefrontCompanyDto, ApiError>({
    queryKey: [...getGetStorefrontCompanyQueryKey()],
    queryFn: getStorefrontCompany,
    staleTime: STALE_TIME.referencia,
  });
}
