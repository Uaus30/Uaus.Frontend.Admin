import {
  ApiError,
  searchPdvProducts,
  type ProductPdvSearchDto,
} from "@workspace/api-client-react";
import { searchLocalProducts, type LocalProduct } from "@/offline";

/**
 * Busca de produtos do PDV, com a base local como plano B.
 *
 * Vive aqui, e não dentro da tela, porque mais de um lugar precisa dela: o
 * balcão (carrinho) e o diálogo de baixa de estoque. Duplicar significaria duas
 * regras de fallback divergindo — e é justamente o fallback que decide se o
 * caixa continua funcionando com a internet caída.
 *
 * Quem chama fica com o que é da tela: foco, leitura de código de barras, toast.
 */

/** Quantos resultados a busca online devolve, alinhado com o limite da busca local. */
const SEARCH_LIMIT = 20;

/**
 * Converte produtos da base local no formato da API.
 *
 * As telas trabalham com `ProductDto`; o snapshot guarda só o que o balcão usa.
 * Os campos ausentes são preenchidos com valores neutros, e nenhum deles
 * participa da venda ou da baixa — custo, mínimo e datas ficam fora da base
 * local de propósito.
 */
export function toProductPdvSearchDtos(products: LocalProduct[]): ProductPdvSearchDto[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    price: product.price,
    stock: product.stock,
    groupName: null,
    imageUrl: null,
  }));
}

/** Nem a API nem a base local puderam responder à busca. */
export class ProductSearchUnavailableError extends Error {
  constructor() {
    super("A API não respondeu e a base local não está disponível.");
    this.name = "ProductSearchUnavailableError";
  }
}

/**
 * Busca produtos por nome ou código de barras.
 *
 * Com a API fora do ar a busca vai para a base local — inclusive quando a queda
 * acontece **durante** a requisição, que é o caso que mais aparece no balcão. Um
 * erro que o servidor respondeu não vira fallback: ali a busca falhou de
 * verdade, e mostrar resultado local mascararia o problema.
 *
 * @param term Termo digitado pelo operador.
 * @param options `online` decide o caminho preferido.
 * @returns Os produtos encontrados, no mesmo formato nos dois caminhos.
 * @throws {ApiError} Quando o servidor respondeu recusando a busca.
 * @throws {ProductSearchUnavailableError} Quando a rede caiu e a base local
 *   também não respondeu.
 */
export async function searchProducts(
  term: string,
  options: { online: boolean },
): Promise<ProductPdvSearchDto[]> {
  const query = term.trim();
  if (!query) return [];

  if (!options.online) return searchLocally(query);

  try {
    return await searchPdvProducts(query, SEARCH_LIMIT);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return searchLocally(query);
  }
}

/** Busca na base local, traduzindo a indisponibilidade dela num erro próprio. */
async function searchLocally(term: string): Promise<ProductPdvSearchDto[]> {
  try {
    return toProductPdvSearchDtos(await searchLocalProducts(term, SEARCH_LIMIT));
  } catch {
    throw new ProductSearchUnavailableError();
  }
}
