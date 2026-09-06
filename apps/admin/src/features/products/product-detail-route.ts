/**
 * A rota da tela de detalhe do produto.
 *
 * `/produtos/<id do grupo>/detalhes` — o id é o do GRUPO, que é o que a tela
 * edita. O produto filho (a variação) não tem rota própria: quem chega com um
 * id de produto usa `?editar=`, que o `useProductDetailFromUrl` resolve para o
 * grupo antes de trocar a URL pela canônica.
 *
 * Substituiu o `?id=` em 01/09/2026. O parâmetro funcionava, mas dizia que a
 * listagem estava aberta com um detalhe pendurado — e era assim que a página se
 * comportava: quem colava o link via a listagem primeiro e o detalhe depois.
 *
 * ## Por que a listagem e o detalhe compartilham UMA entrada de rota
 *
 * O `<Switch>` do App.tsx dá `key={route.path}` a cada `<Route>`. Duas entradas
 * separadas seriam dois elementos com chaves diferentes: ir da listagem para o
 * detalhe DESMONTARIA a página, e voltar do detalhe devolveria a pessoa a uma
 * listagem recém-nascida — sem o filtro, a busca e a página em que ela estava.
 *
 * Por isso a rota de Produtos declara `matchPath` com os dois segmentos
 * opcionais ({@link PRODUCTS_MATCH_PATH}): um `<Route>` só responde pelos dois
 * caminhos, a página nunca desmonta, e o menu continua apontando para `/produtos`
 * porque quem o monta lê o `path`, não o `matchPath`.
 */

/** Último segmento do caminho do detalhe. */
const SECAO_DETALHE = "detalhes";

/**
 * Padrão que a rota de Produtos usa no `<Switch>`.
 *
 * Os dois segmentos são opcionais para que `/produtos` e
 * `/produtos/709/detalhes` casem no MESMO `<Route>` — ver o cabeçalho.
 */
export const PRODUCTS_MATCH_PATH = "/produtos/:id?/:secao?";

/** Caminho da listagem, já com o base do Vite. */
export function productsListPathname(): string {
  return `${import.meta.env.BASE_URL}produtos`;
}

/**
 * Caminho do detalhe de um grupo, já com o base do Vite.
 *
 * O base entra porque este valor vai para o `history.pushState` e para links de
 * nova aba, que falam em pathname absoluto — montar "/produtos" na mão quebraria
 * um deploy em subpasta.
 */
export function productDetailPathname(productGroupId: number): string {
  return `${import.meta.env.BASE_URL}produtos/${productGroupId}/${SECAO_DETALHE}`;
}

/**
 * Id do grupo pedido por um pathname, ou `null` quando ele não é de detalhe.
 *
 * Lê por expressão regular, e não pelos parâmetros do router, porque os dois
 * chamadores precisam da resposta ANTES do primeiro render: a página, para não
 * desenhar a listagem que vai ser substituída, e o hook de abertura, para
 * disparar a busca do produto na montagem. O base do Vite é ignorado de
 * propósito — o que importa é o fim do caminho.
 */
export function productGroupIdFromPathname(pathname: string): number | null {
  const casou = new RegExp(`/produtos/(\\d+)/${SECAO_DETALHE}/?$`).exec(pathname);
  if (!casou) return null;

  const id = Number(casou[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Aba em que o detalhe abre. Só estas duas são endereçáveis. */
export type DetailTab = "dados" | "estoque";

/** Parâmetro que escolhe a aba de abertura: `?aba=estoque`. */
export const DETAIL_TAB_PARAM = "aba";

/**
 * Parâmetro que escolhe a VARIAÇÃO aberta na aba de Estoque: `?variacao=<produto>`.
 *
 * A aba consulta as entradas de UM produto, e o seletor dela começa na primeira
 * variação em ordem alfabética. Sem este parâmetro, receber uma compra de
 * "BALDE [12L, ORIGINAL]" mostraria as entradas de "BALDE [12L, MASTER]" — uma
 * lista que não contém a entrada que acabou de ser gravada.
 */
export const DETAIL_STOCK_PRODUCT_PARAM = "variacao";

/**
 * Caminho do detalhe já pedindo a aba de Estoque, opcionalmente na variação
 * indicada.
 *
 * Existe para quem chega DEPOIS de mexer no estoque — hoje o recebimento de uma
 * compra de produto já cadastrado. Cair em Dados obrigaria a clicar numa aba
 * para ver a entrada que a própria ação acabou de gravar; o pedido era "exibir
 * o detalhe do produto com as entradas atualizadas".
 */
export function productStockTabPathname(productGroupId: number, productId?: number | null): string {
  const caminho = `${productDetailPathname(productGroupId)}?${DETAIL_TAB_PARAM}=estoque`;
  return productId != null && productId > 0
    ? `${caminho}&${DETAIL_STOCK_PRODUCT_PARAM}=${productId}`
    : caminho;
}

/**
 * Variação pedida pela URL atual, ou `null`.
 *
 * Só valida o formato. Se o id não pertencer ao grupo aberto, quem descarta é a
 * própria aba, que confere a escolha contra as variações existentes.
 */
export function stockProductIdFromUrl(): number | null {
  if (typeof window === "undefined") return null;

  const bruto = new URLSearchParams(window.location.search).get(DETAIL_STOCK_PRODUCT_PARAM);
  const id = Number(bruto);
  return bruto !== null && Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Aba pedida pela URL atual, lida UMA vez, antes do primeiro render.
 *
 * Qualquer outro valor cai em `dados`: a aba de abertura vem da barra de
 * endereços, que qualquer um edita, e um valor desconhecido não pode deixar a
 * tela sem aba selecionada.
 */
export function detailTabFromUrl(): DetailTab {
  if (typeof window === "undefined") return "dados";

  return new URLSearchParams(window.location.search).get(DETAIL_TAB_PARAM) === "estoque"
    ? "estoque"
    : "dados";
}
