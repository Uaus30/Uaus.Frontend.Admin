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
import { apiGet, apiGetOrThrow, ApiError, mapPagedResult } from "../client";
import { STALE_TIME } from "../query-client";
import type {
  BackendPagedResult,
  QueryKey,
  StorefrontCompanyDto,
  StorefrontDepartmentDto,
  StorefrontFlashPromotionDto,
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
  /** Departamento (nível 1 da taxonomia). */
  departmentId?: number;
  /** Categoria (nível 2). Vindo junto com o departamento, valem os dois. */
  categoryId?: number;
  page?: number;
  size?: number;
  /**
   * Teto de cards com promoção na página. **Só a seção Novidades usa.**
   *
   * Sem ele, marcar quarenta produtos como isca faz a seção parar de mostrar
   * novidade nenhuma e a etiqueta parar de significar alguma coisa — o preço de
   * usar destaque para tudo é não destacar nada. A página pode vir com MENOS
   * itens que `size` quando não há produto sem promoção para preencher.
   */
  maxPromoted?: number;
}

/** Uma página de cards da vitrine, sem autenticação. */
export async function getStorefrontProductsPage(
  params?: StorefrontProductsPageParams,
): Promise<UiPagedResult<StorefrontProductDto>> {
  const result = await apiGetOrThrow<BackendPagedResult<StorefrontProductDto>>(
    "/Storefront/products",
    {
      search: params?.search,
      departmentId: params?.departmentId,
      categoryId: params?.categoryId,
      page: params?.page ?? 1,
      size: params?.size ?? 24,
      maxPromoted: params?.maxPromoted,
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

/** Prefixo da árvore de filtros — quem consulta acrescenta a busca. */
export const getGetStorefrontDepartmentsQueryKey = (): QueryKey => ["storefront-departments"];

/** Departamentos e categorias com produto visível, para a lista de filtros. */
export function getStorefrontDepartments(search?: string): Promise<StorefrontDepartmentDto[]> {
  return apiGetOrThrow<StorefrontDepartmentDto[]>("/Storefront/departments", { search }, { auth: false });
}

/**
 * Árvore de filtros da vitrine.
 *
 * `staleTime` de catálogo, e não de referência: a contagem acompanha a busca e o
 * cadastro do admin, então ela envelhece junto com a grade. Cachear a árvore por
 * mais tempo que a listagem deixaria "Cozinha (7)" ao lado de três cards — e
 * ninguém invalida cache no navegador de um visitante.
 */
export function useGetStorefrontDepartments(search?: string) {
  return useQuery<StorefrontDepartmentDto[], ApiError>({
    queryKey: [...getGetStorefrontDepartmentsQueryKey(), search ?? ""],
    queryFn: () => getStorefrontDepartments(search),
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

/** Prefixo da relâmpago do banner da home. */
export const getGetStorefrontFlashPromotionQueryKey = (): QueryKey => ["storefront-flash-promotion"];

/**
 * A relâmpago do banner, ou `null` — que é o caso da maior parte da semana.
 *
 * `apiGet`, e **não** `apiGetOrThrow`: sem promoção no ar o endpoint devolve
 * **204**, e o `apiGetOrThrow` trata corpo vazio como falha do servidor. Com ele
 * aqui, toda visita à home de um dia sem relâmpago — a maioria — gastaria quatro
 * requisições (a original e as três tentativas do React Query) e encheria o
 * console do site público de erro. "Não há banner hoje" é resposta, não falha.
 *
 * Medido contra a API de dev em 19/09/2026: `GET /Storefront/flash-promotion`
 * sem promoção vigente responde `204 No Content`.
 */
export function getStorefrontFlashPromotion(): Promise<StorefrontFlashPromotionDto | null> {
  return apiGet<StorefrontFlashPromotionDto>("/Storefront/flash-promotion", undefined, {
    auth: false,
  });
}

/**
 * A relâmpago do banner.
 *
 * `staleTime` de CATÁLOGO, e não de referência: ela começa e acaba dentro do
 * mesmo dia, e um cache longo deixaria o banner no ar depois de a promoção
 * terminar — ou escondido depois de ela começar. Quem conta os segundos é a
 * tela, com o `endsInSeconds` que veio na resposta.
 */
export function useGetStorefrontFlashPromotion() {
  return useQuery<StorefrontFlashPromotionDto | null, ApiError>({
    queryKey: [...getGetStorefrontFlashPromotionQueryKey()],
    queryFn: getStorefrontFlashPromotion,
    staleTime: STALE_TIME.catalogo,
  });
}
