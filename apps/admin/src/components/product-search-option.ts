import type { ProductDto } from "@workspace/api-client-react";

/**
 * Produto devolvido pela busca.
 *
 * `price` e `costPrice` viajam junto porque a entrada de estoque sugere os dois
 * ao escolher o produto; a baixa de estoque simplesmente os ignora. Trazê-los
 * aqui evita uma segunda consulta só para preencher dois campos que a listagem
 * já devolveu.
 */
export type ProductSearchOption = {
  id: number;
  /**
   * Grupo do produto. A compra precisa dele para carregar as VARIAÇÕES irmãs:
   * escolher uma cor no seletor abre a grade do produto inteiro.
   */
  productGroupId: number;
  name: string;
  barcode: string | null;
  stock: number;
  /** Preço de venda vigente do cadastro. */
  price: number;
  /** Último custo apurado pelo backend a partir dos lotes. */
  costPrice: number;
};

/**
 * Um produto da listagem no formato que a busca entrega a quem escolhe.
 *
 * Exportado porque a busca não é o único jeito de chegar a um produto: o código
 * bipado na compra (24/09/2026) encontra o produto pela mesma listagem e precisa
 * entregá-lo no MESMO formato ao `selectProduct` — duas conversões divergiriam no
 * dia em que uma delas ganhasse um campo.
 */
export function toProductSearchOption(product: ProductDto): ProductSearchOption {
  return {
    id: product.id,
    productGroupId: product.productGroupId,
    name: product.displayName || product.name,
    barcode: product.barcode || null,
    stock: product.stock,
    price: product.price,
    costPrice: product.costPrice,
  };
}
