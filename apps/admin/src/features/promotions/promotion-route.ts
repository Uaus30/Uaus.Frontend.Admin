/**
 * As rotas da tela de Promoções.
 *
 * `/marketing/promocoes` — a listagem.
 * `/marketing/promocoes/nova` — o cadastro.
 * `/marketing/promocoes/<id>` — o detalhe de uma promoção.
 *
 * ## Por que os três caminhos compartilham UMA entrada de rota
 *
 * O `<Switch>` do App.tsx dá `key={route.path}` a cada `<Route>`. Entradas
 * separadas seriam elementos com chaves diferentes: ir da listagem para o
 * cadastro DESMONTARIA a página, e voltar devolveria a pessoa a uma listagem
 * recém-nascida — sem o filtro, a busca e a página em que ela estava. É o mesmo
 * motivo (e o mesmo desenho) de `PRODUCTS_MATCH_PATH`.
 *
 * ## Por que tela, e não modal
 *
 * Pedido do dono, com duas razões concretas: a URL de uma promoção específica
 * pode ser compartilhada, e a aba Performance (fase 2) precisa de espaço que uma
 * modal não dá sem virar uma janela dentro da janela.
 */

/** Segmento do cadastro novo. Não é id, e é isso que o distingue. */
const SEGMENTO_NOVA = "nova";

/** Caminho da listagem, sem o base do Vite — é o que o menu usa. */
export const PROMOTIONS_PATH = "/marketing/promocoes";

/**
 * Padrão que a rota de Promoções usa no `<Switch>`.
 *
 * O segmento é opcional para que os três caminhos casem no MESMO `<Route>`.
 */
export const PROMOTIONS_MATCH_PATH = "/marketing/promocoes/:segmento?";

/** Caminho da listagem, já com o base do Vite. */
export function promotionsListPathname(): string {
  return `${import.meta.env.BASE_URL}marketing/promocoes`;
}

/** Caminho do cadastro novo, já com o base do Vite. */
export function promotionCreatePathname(): string {
  return `${promotionsListPathname()}/${SEGMENTO_NOVA}`;
}

/** Caminho do detalhe de uma promoção, já com o base do Vite. */
export function promotionDetailPathname(id: number): string {
  return `${promotionsListPathname()}/${id}`;
}

/**
 * O que o pathname atual está pedindo.
 *
 * Lido por expressão regular, e não pelos parâmetros do router, porque a página
 * precisa da resposta ANTES do primeiro render — para não desenhar a listagem
 * que vai ser substituída. O base do Vite é ignorado de propósito: o que importa
 * é o fim do caminho.
 */
export type PromotionScreen = { kind: "lista" } | { kind: "nova" } | { kind: "detalhe"; id: number };

export function promotionScreenFromPathname(pathname: string): PromotionScreen {
  const casou = /\/marketing\/promocoes\/([^/]+)\/?$/.exec(pathname);
  if (!casou) return { kind: "lista" };

  const segmento = casou[1];
  if (segmento === SEGMENTO_NOVA) return { kind: "nova" };

  const id = Number(segmento);
  // Segmento desconhecido cai na listagem: a barra de endereços é editável por
  // qualquer um, e um id inválido não pode deixar a tela em branco.
  return Number.isInteger(id) && id > 0 ? { kind: "detalhe", id } : { kind: "lista" };
}
