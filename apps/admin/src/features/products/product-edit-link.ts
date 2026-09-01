/**
 * Link direto que abre o detalhe de um produto na tela de Produtos.
 *
 * O formato é `/produtos?busca=<grupo>&editar=<id do produto>`, e ele existe
 * porque quem chama conhece o id do PRODUTO — a variação que apareceu na busca
 * —, não o do GRUPO, que é o que a rota do detalhe
 * (`/produtos/<grupo>/detalhes`) pede. O `useProductDetailFromUrl` resolve o
 * grupo no servidor e troca a URL pela canônica.
 *
 * O papel de cada parâmetro mudou em 01/09/2026:
 *
 * - `editar` é o que ABRE o detalhe, e sozinho já basta. Antes ele só escolhia
 *   uma linha da listagem, e por isso dependia do `busca`.
 * - `busca` deixou de ser necessário para abrir; ficou porque filtra a listagem
 *   que aparece quando a pessoa FECHA o detalhe. Enquanto ele participava da
 *   abertura, mandar o código de barras em vez do nome do grupo abria uma lista
 *   vazia e o link não fazia nada.
 *
 * Do lado do PDV existe a versão absoluta em `apps/pdv/src/lib/admin-links.ts`,
 * que precisa descobrir o host do admin; dentro do admin o caminho relativo
 * basta.
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
