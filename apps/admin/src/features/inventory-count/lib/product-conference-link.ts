import { productDetailPathname } from "@/features/products/product-detail-route";

/**
 * Marca que o operador chegou ao produto VINDO da conferência.
 *
 * Existe porque marcar "conferido" tem dois donos: quem está varrendo a lista da
 * conferência — e quer voltar para ela e pegar o próximo — e quem abriu o
 * produto pela tela de Produtos para corrigir um preço e, de passagem, viu a
 * tarja. Mandar os dois para a mesma tela erraria com um deles.
 */
export const FROM_INVENTORY_COUNT_PARAM = "conferencia";

/** Caminho do detalhe do produto, carimbado como vindo da conferência. */
export function productDetailFromCountPathname(productGroupId: number): string {
  return `${productDetailPathname(productGroupId)}?${FROM_INVENTORY_COUNT_PARAM}=1`;
}

/**
 * A URL atual diz que viemos da conferência.
 *
 * Leia UMA vez, na montagem: a tela de detalhe reescreve a barra de endereços
 * enquanto o produto é editado, e consultar de novo mais tarde devolveria
 * `false` para quem veio da lista.
 */
export function cameFromInventoryCount(): boolean {
  if (typeof window === "undefined") return false;

  return new URLSearchParams(window.location.search).get(FROM_INVENTORY_COUNT_PARAM) === "1";
}
