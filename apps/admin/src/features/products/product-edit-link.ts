/**
 * Link direto que abre o detalhe de um produto na tela de Produtos.
 *
 * O formato (`/produtos?busca=<grupo>&editar=<id>`) é lido por dois lugares
 * desta mesma pasta — `useProductTable` consome o `busca` e `useProductDeepLink`
 * consome o `editar` — e por isso a montagem mora aqui, ao lado de quem lê. Do
 * lado do PDV existe a versão absoluta em `apps/pdv/src/lib/admin-links.ts`, que
 * precisa descobrir o host do admin; dentro do admin o caminho relativo basta.
 *
 * Os DOIS parâmetros são necessários, e já custaram um bug cada:
 *
 * - `busca` traz o produto para a página. A listagem é paginada e filtra por
 *   **grupo**, então o termo tem que ser o nome do grupo — mandar o código de
 *   barras abria uma lista vazia.
 * - `editar` diz QUAL linha abrir. Sem ele a tela só filtrava, e a pessoa tinha
 *   que procurar e clicar de novo.
 */

/** O que uma listagem sabe do produto na hora de mandar editar. */
export type ProdutoParaEditar = {
  id: number;
  name: string;
  /** Nome do GRUPO — é por ele que a listagem de produtos filtra. */
  groupName?: string | null;
};

/**
 * Caminho (relativo à raiz do admin) que abre o detalhe do produto.
 *
 * @param produto Produto escolhido na listagem de origem.
 */
export function productEditPath(produto: ProdutoParaEditar): string {
  const termo = produto.groupName?.trim() || produto.name;
  const query = new URLSearchParams({ busca: termo, editar: String(produto.id) });

  // `BASE_URL` termina em "/" por garantia do Vite, e respeita o `BASE_PATH` do
  // build — montar "/produtos" na mão quebraria um deploy em subpasta.
  return `${import.meta.env.BASE_URL}produtos?${query}`;
}

/**
 * Abre o detalhe do produto em NOVA ABA.
 *
 * Nova aba, e não navegação, porque quem clica está no meio de outra coisa: na
 * tela de etiquetas há um lote montado em memória, que não está salvo em lugar
 * nenhum e sumiria na navegação. O `noopener` impede que a aba aberta consiga
 * navegar a aba de origem — que é justamente a que tem o trabalho não salvo.
 *
 * @param produto Produto escolhido na listagem de origem.
 */
export function openProductEditTab(produto: ProdutoParaEditar): void {
  window.open(productEditPath(produto), "_blank", "noopener,noreferrer");
}
