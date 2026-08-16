/**
 * Destino pós-login.
 *
 * O guard de rota mandava para `/login` sem dizer de onde a pessoa veio, e o
 * login mandava todo mundo para `/dashboard`. Quem chegava por link direto
 * perdia o destino na ida — o caso real é o botão "editar produto" do PDV, que
 * abre `/produtos?busca=...&editar=...` numa aba nova: sem sessão, a pessoa
 * digitava a senha e caía no painel, sem nenhuma pista do que tinha pedido.
 *
 * O caminho é validado nos DOIS sentidos, mas o que importa é a volta:
 * `?redirect=` é texto na URL, e qualquer um pode montar
 * `admin.uaus.com.br/login?redirect=https://site-falso` e mandar por e-mail.
 * Aceitar isso transformaria a tela de login numa ponte de phishing — a pessoa
 * confere o domínio ANTES de digitar a senha, e a saída para o site do atacante
 * aconteceria depois dela, já autenticada e sem conferir nada.
 */

/** Nome do parâmetro que carrega o destino na URL do login. */
export const PARAM_DESTINO = "redirect";

/**
 * Só caminho relativo deste mesmo app passa.
 *
 * Recusa, nesta ordem: caminho que não começa com `/` (`https://outro.site`,
 * `javascript:...`), `//outro.site` (URL sem protocolo — o navegador trata como
 * host externo), `/\outro.site` (alguns navegadores normalizam a barra
 * invertida) e o próprio `/login`, que faria a volta cair em laço.
 */
function caminhoInternoSeguro(valor: string): string | null {
  const caminho = valor.trim();

  // `/` sozinho vale; depois da primeira barra não pode vir outra barra nem
  // barra invertida, senão o "caminho" é um host.
  if (!/^\/($|[^/\\])/.test(caminho)) return null;
  if (/^\/login(\?|#|$)/.test(caminho)) return null;

  return caminho;
}

/**
 * URL do login preservando o caminho pedido.
 *
 * @param caminho Caminho interno atual COM query string, relativo à base do
 *   router (ex.: `/produtos?busca=Caneca&editar=10`).
 * @returns `/login` puro quando o caminho não é um destino aceitável — cair no
 *   dashboard é melhor que propagar um valor suspeito até o outro lado.
 */
export function urlLoginCom(caminho: string): string {
  const destino = caminhoInternoSeguro(caminho);
  return destino === null ? "/login" : `/login?${PARAM_DESTINO}=${encodeURIComponent(destino)}`;
}

/**
 * Caminho para onde ir depois de autenticar, ou `null` quando não há destino
 * confiável — quem chama decide o padrão.
 *
 * @param busca Query string da URL do login, com ou sem `?` na frente
 *   (`window.location.search` e o `useSearch` do wouter divergem nesse ponto).
 */
export function destinoAposLogin(busca: string): string | null {
  const bruto = new URLSearchParams(busca).get(PARAM_DESTINO);
  return bruto === null ? null : caminhoInternoSeguro(bruto);
}
