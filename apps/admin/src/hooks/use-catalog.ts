import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@workspace/api-client-react";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllCustomers } from "@/services/customers.service";
import { getAllImages, getAllProductImages } from "@/services/images.service";
import { getAllProductGroups, getAllProductTags, getAllProducts } from "@/services/products.service";
import { getAllSuppliers } from "@/services/suppliers.service";
import { getAllTags } from "@/services/tags.service";
import { orderSupplierOptions } from "@/lib/supplier-options";

/**
 * Catálogos completos, com UMA chave de cache por recurso.
 *
 * Antes disso a chave era nomeada pelo CONSUMIDOR: o mesmo `getAllDepartments()`
 * vivia sob `departments-all-for-categories`, `-for-grades` e `-for-products`, e
 * `getAllCategories()` sob quatro chaves. Duas consequências, as duas
 * verificadas:
 *
 * 1. A mesma varredura paginada rodava uma vez por feature consumidora. Abrir
 *    categorias, grades e o editor de produtos baixava a lista de departamentos
 *    três vezes.
 * 2. A feature que mantém o recurso invalidava só ALGUMAS dessas chaves. Criar
 *    um departamento e ir para o editor de produtos mostrava a lista antiga,
 *    porque `departments-all-for-products` não estava na lista de invalidação de
 *    `useDepartments`.
 *
 * Com uma chave por recurso, quem cria invalida uma coisa só e todo mundo
 * enxerga. As chaves ficam em `CATALOG_KEYS` para a invalidação não voltar a
 * depender de string literal espalhada pelas features.
 */

/**
 * Prefixo de cada RECURSO.
 *
 * Tudo que depende de um recurso vive sob o prefixo dele — a listagem paginada
 * da feature, o catálogo completo, a busca do autocomplete. Assim quem cria ou
 * edita invalida o prefixo e alcança as três, sem precisar conhecer as chaves
 * das outras features.
 *
 * Antes, o editor de produtos invalidava `["tags-page"]` — uma chave declarada
 * dentro da feature de etiquetas — por string literal. E `["tags-search"]`, do
 * autocomplete, não era invalidada por ninguém: criar uma etiqueta pelo editor
 * não a fazia aparecer na busca da mesma tela.
 */
export const RESOURCE_KEYS = {
  departments: ["departments"],
  categories: ["categories"],
  tags: ["tags"],
  productTags: ["product-tags"],
  productGroups: ["product-groups"],
  suppliers: ["suppliers"],
  customers: ["customers"],
  images: ["images"],
  productImages: ["product-images"],
  products: ["products"],
} as const;

/** Chave do catálogo completo de cada recurso. */
export const CATALOG_KEYS = {
  departments: [...RESOURCE_KEYS.departments, "all"],
  categories: [...RESOURCE_KEYS.categories, "all"],
  tags: [...RESOURCE_KEYS.tags, "all"],
  productTags: [...RESOURCE_KEYS.productTags, "all"],
  productGroups: [...RESOURCE_KEYS.productGroups, "all"],
  suppliers: [...RESOURCE_KEYS.suppliers, "all"],
  customers: [...RESOURCE_KEYS.customers, "all"],
  images: [...RESOURCE_KEYS.images, "all"],
  productImages: [...RESOURCE_KEYS.productImages, "all"],
  products: [...RESOURCE_KEYS.products, "all"],
} as const;

/**
 * Catálogo muda pouco e é lido por muitas telas.
 *
 * Cinco minutos evita refazer a varredura a cada navegação entre features que
 * usam a mesma lista — e a invalidação explícita de quem cria/edita continua
 * valendo, porque invalidação ignora staleTime.
 *
 * O número mora em `STALE_TIME.catalogo`, no api-client, para o PDV e o admin
 * envelhecerem o mesmo dado no mesmo prazo.
 */
const CATALOG_STALE_TIME = STALE_TIME.catalogo;

/** `enabled` permite ao consumidor adiar a carga (modal fechada, por exemplo). */
interface CatalogOptions {
  enabled?: boolean;
}

export function useAllDepartments(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.departments,
    queryFn: () => getAllDepartments(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllCategories(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.categories,
    queryFn: () => getAllCategories(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllTags(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.tags,
    queryFn: () => getAllTags(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllProductTags(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.productTags,
    queryFn: () => getAllProductTags(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllProductGroups(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.productGroups,
    queryFn: () => getAllProductGroups(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllSuppliers(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.suppliers,
    queryFn: () => getAllSuppliers(),
    select: orderSupplierOptions,
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllCustomers(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.customers,
    queryFn: () => getAllCustomers(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllImages(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.images,
    queryFn: () => getAllImages(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

export function useAllProductImages(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.productImages,
    queryFn: () => getAllProductImages(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}

/**
 * NÃO existe mais um `useAllSales`, e não deve voltar a existir.
 *
 * Ele era o único `useAll*` que varria uma tabela que cresce SEM LIMITE. Os
 * demais são catálogo — departamento, categoria, etiqueta — e estabilizam em
 * dezenas ou centenas de linhas. Venda não estabiliza nunca.
 *
 * O único consumidor era a tela de clientes, que baixava a operação inteira da
 * loja para somar quanto cada cliente já tinha comprado. Essa conta pertence ao
 * servidor: hoje sai de `GET /Customers/summary`
 * (`useGetCustomerSummaries`, no api-client), em UMA requisição, seja qual for o
 * tamanho da base. Item 4.1 do plano de refatoração.
 *
 * Se aparecer a necessidade de "todas as vendas" de novo, o endereço é que
 * precisa de filtro ou agregação — `fetchAllPages` lança ao passar de
 * `FETCH_ALL_PAGES_MAX_ITEMS` justamente para essa conversa acontecer antes de a
 * tela quebrar em produção.
 */

/** Todos os produtos vendáveis. */
export function useAllProducts(options?: CatalogOptions) {
  return useQuery({
    queryKey: CATALOG_KEYS.products,
    queryFn: () => getAllProducts(),
    staleTime: CATALOG_STALE_TIME,
    enabled: options?.enabled,
  });
}
