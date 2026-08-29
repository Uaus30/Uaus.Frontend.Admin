/**
 * Hosts que servem a loja de verdade.
 *
 * A lista é de PRODUÇÃO, e não de desenvolvimento, de propósito — é a mesma
 * inversão que o `vercel.json` faz para escolher qual API o front chama. Um host
 * novo que ninguém lembrou de cadastrar nasce marcado como desenvolvimento, que
 * é o lado seguro do erro: no pior caso alguém vê a faixa de aviso onde não
 * precisava. A lista invertida erraria para o outro lado, deixando um ambiente
 * de teste passar por produção — e é justamente isso que a faixa existe para
 * impedir.
 */
const PRODUCTION_HOSTS = ["admin.uaus.com.br", "pdv.uaus.com.br", "uaus.com.br", "www.uaus.com.br"];

/**
 * Diz se o app está rodando fora de produção.
 *
 * Vale para os domínios `*-dev`, para os previews da Vercel e para o
 * `localhost` do desenvolvimento local. O `hostname` só é recebido por
 * parâmetro nos testes; em runtime ele sai do `window`.
 */
export function isDevEnvironment(hostname?: string): boolean {
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");

  // Sem `window` (teste de nó, render fora do navegador) não há como afirmar que
  // é desenvolvimento — e afirmar por engano colocaria a faixa em produção.
  if (!host) return false;

  return !PRODUCTION_HOSTS.includes(host.toLowerCase());
}
