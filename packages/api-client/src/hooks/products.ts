/**
 * Produtos.
 *
 * Por enquanto só a TABELA do admin mora aqui. O CRUD de produto ainda vive em
 * `apps/admin/src/services/products.service.ts`, congelado à espera da migração —
 * este arquivo é a cabeça de ponte, não a migração inteira.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGetOrThrow, ApiError, mapPagedResult } from "../client";
import type { BackendPagedResult, ProductTableRowDto, QueryKey, UiPagedResult } from "../models";

/**
 * Prefixo da tabela de produtos.
 *
 * Fica SOB `["products"]` de propósito: quem cria, edita ou exclui um produto
 * invalida o prefixo do recurso e alcança a tabela junto, sem precisar conhecer
 * esta chave. Um prefixo irmão (`["product-table"]`) compilaria igual e deixaria
 * a tela mostrando o preço antigo depois de salvar.
 */
export const getGetProductTableQueryKey = (): QueryKey => ["products", "table"];

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
 * @param params Busca (pelo nome/descrição do GRUPO), página e linhas por página.
 */
export function useGetProductTable(
  params?: { search?: string; page?: number; limit?: number },
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
        page: params?.page ?? 1,
        size: params?.limit ?? 10,
      });
      return mapPagedResult(result);
    },
    ...options?.query,
  });
}
