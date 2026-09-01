/**
 * Produtos.
 *
 * Por enquanto só a TABELA do admin mora aqui. O CRUD de produto ainda vive em
 * `apps/admin/src/services/products.service.ts`, congelado à espera da migração —
 * este arquivo é a cabeça de ponte, não a migração inteira.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiPost, apiGetOrThrow, ApiError, mapPagedResult } from "../client";
import type {
  BackendPagedResult,
  ProductDto,
  ProductGroupDto,
  ProductTableRowDto,
  QueryKey,
  UiPagedResult,
} from "../models";

/**
 * Prefixo da tabela de produtos.
 *
 * Fica SOB `["products"]` de propósito: quem cria, edita ou exclui um produto
 * invalida o prefixo do recurso e alcança a tabela junto, sem precisar conhecer
 * esta chave. Um prefixo irmão (`["product-table"]`) compilaria igual e deixaria
 * a tela mostrando o preço antigo depois de salvar.
 */
export const getGetProductTableQueryKey = (): QueryKey => ["products", "table"];

/** Filtros da página da tabela de produtos. */
export interface ProductTableParams {
  search?: string;
  departmentId?: number;
  categoryId?: number;
  status?: number;
  page?: number;
  limit?: number;
}

/**
 * Página da tabela de produtos do admin, montada pelo servidor.
 *
 * Uma requisição devolve a linha inteira: grupo, categoria, departamento, produto
 * representante, etiquetas e imagens. Antes disso a tela montava a mesma linha em
 * CASCATA de quatro níveis — a página de grupos, depois uma consulta de produtos
 * por grupo, depois etiquetas e imagens por produto, depois cada imagem por id.
 * Como cada endpoint filtra por UM id de cada vez, uma página de 20 grupos com
 * variações passava de 200 requisições, e as quatro idas e voltas eram em série:
 * nenhuma começava antes de a anterior terminar.
 *
 * @param params Busca, departamento, categoria, status, página e linhas por página.
 */
export function useGetProductTable(
  params?: ProductTableParams,
  options?: {
    query?: Omit<
      UseQueryOptions<
        UiPagedResult<ProductTableRowDto>,
        ApiError,
        UiPagedResult<ProductTableRowDto>,
        QueryKey
      >,
      "queryKey" | "queryFn"
    >;
  },
) {
  return useQuery<UiPagedResult<ProductTableRowDto>, ApiError, UiPagedResult<ProductTableRowDto>, QueryKey>({
    queryKey: [...getGetProductTableQueryKey(), params ?? {}],
    queryFn: async () => {
      const result = await apiGetOrThrow<BackendPagedResult<ProductTableRowDto>>("/Products/table", {
        search: params?.search,
        departmentId: params?.departmentId,
        categoryId: params?.categoryId,
        status: params?.status,
        page: params?.page ?? 1,
        size: params?.limit ?? 10,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}

/** Um produto do salvamento em lote. `id` nulo cria; preenchido atualiza. */
export interface SaveProductGroupProductPayload {
  id?: number | null;
  name: string;
  description?: string | null;
  barcode?: string | null;
  price: number;
  minStock?: number;
  /** Código numérico do status (`getStatusNumber` da tela). */
  status: number;
  variationValues?: Array<{ gradeType: number; value: string; displayOrder: number }>;
}

/** O cadastro inteiro: grupo + produtos/variações, gravados numa transação só. */
export interface SaveProductGroupWithProductsPayload {
  /** Nulo cria o grupo; preenchido atualiza. */
  groupId?: number | null;
  categoryId: number;
  name: string;
  description?: string | null;
  hasVariations: boolean;
  showOnSite: boolean;
  products: SaveProductGroupProductPayload[];
}

/** Resposta do salvamento: produtos na MESMA ordem do envio. */
export interface SavedProductGroupWithProductsDto {
  group: ProductGroupDto;
  products: ProductDto[];
}

/**
 * Salva grupo e produtos/variações em UMA transação
 * (`POST /ProductGroups/save-with-products`).
 *
 * Substitui a sequência de N requisições do editor: um código de barras
 * duplicado na terceira variação deixava grupo e duas variações gravados, com
 * estado parcial invisível até a próxima abertura. Ou grava tudo, ou nada muda.
 * Produto ausente da lista não é tocado — excluir variação continua no fluxo
 * próprio de exclusão.
 */
export async function saveProductGroupWithProducts(
  payload: SaveProductGroupWithProductsPayload,
): Promise<SavedProductGroupWithProductsDto> {
  const response = await apiPost<SavedProductGroupWithProductsDto>(
    "/ProductGroups/save-with-products",
    payload,
  );
  if (!response.data) throw new Error("Não foi possível salvar o cadastro do produto.");
  return response.data;
}
