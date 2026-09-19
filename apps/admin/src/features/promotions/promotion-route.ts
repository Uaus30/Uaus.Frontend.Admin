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
 * ## Os caminhos são RELATIVOS AO BASE
 *
 * Quem navega é o wouter (`setLocation`), e ele já monta o `base` declarado no
 * `<WouterRouter>` do App. Prefixar `import.meta.env.BASE_URL` aqui produziria
 * `/admin/admin/marketing/...` num deploy em subpasta.
 *
 * ## Por que tela, e não modal
 *
 * Pedido do dono, com duas razões concretas: a URL de uma promoção específica
 * pode ser compartilhada, e a aba Performance (fase 2) precisa de espaço que uma
 * modal não dá sem virar uma janela dentro da janela.
 */

/** Segmento do cadastro novo. Não é id, e é isso que o distingue. */
const SEGMENTO_NOVA = "nova";

/** Caminho da listagem — é o que o menu usa. */
export const PROMOTIONS_PATH = "/marketing/promocoes";

/**
 * Padrão que a rota de Promoções usa no `<Switch>`.
 *
 * O segmento é opcional para que os três caminhos casem no MESMO `<Route>`.
 */
export const PROMOTIONS_MATCH_PATH = "/marketing/promocoes/:segmento?";

/** Caminho do cadastro novo. */
export function promotionCreatePathname(): string {
  return `${PROMOTIONS_PATH}/${SEGMENTO_NOVA}`;
}

/**
 * Caminho do cadastro novo já apontando para a promoção a repetir.
 *
 * A promoção de origem viaja na URL, e não em estado de tela: o cadastro é uma
 * TELA, e um F5 no meio do preenchimento perderia a origem — a pessoa voltaria
 * para um formulário em branco sem entender por quê.
 */
export function promotionRepeatPathname(id: number): string {
  return `${promotionCreatePathname()}?repetir=${id}`;
}

/**
 * A promoção que o cadastro novo deve copiar, ou `undefined`.
 *
 * Pura e separada para ter teste: é o que decide se o formulário abre em branco
 * ou preenchido, e um id inválido na barra de endereços não pode deixar a tela
 * esperando por uma promoção que não existe.
 */
export function promotionRepeatSourceFromSearch(search: string): number | undefined {
  const id = Number(new URLSearchParams(search).get("repetir"));
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Caminho do detalhe de uma promoção. */
export function promotionDetailPathname(id: number): string {
  return `${PROMOTIONS_PATH}/${id}`;
}

/**
 * O que o caminho atual está pedindo.
 *
 * Lê por expressão regular, e não pelos parâmetros do router, porque a mesma
 * função responde tanto para a location do wouter (sem o base) quanto para um
 * `window.location.pathname` cru (com o base) — o que importa é o fim do
 * caminho.
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
