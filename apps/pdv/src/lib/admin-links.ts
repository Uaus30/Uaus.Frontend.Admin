/**
 * Links para o painel administrativo.
 *
 * A topologia real é **um subdomínio por app**: o PDV em `pdv.uaus.com.br` e o
 * admin em `admin.uaus.com.br`. A primeira versão deste módulo assumiu o
 * contrário — que o PDV era publicado sob `/pdv/` no mesmo host — e por isso
 * caía em `window.location.origin` quando não havia variável de ambiente. O
 * resultado é que "Painel Administrativo" abria **outra aba do próprio PDV**, e
 * o botão de editar produto também: o link funcionava, só apontava para o lugar
 * errado, que é o tipo de defeito que ninguém reporta como erro.
 *
 * A ordem de resolução é: variável de ambiente, depois derivação do subdomínio,
 * depois o par de portas do ambiente de desenvolvimento. Não havendo nenhuma
 * das três, o módulo devolve `null` — e quem chama **desabilita o link** em vez
 * de abrir o PDV de novo. Voltar a mandar para a origem seria repetir o bug em
 * silêncio.
 */

/** Porta do dev server do admin (`apps/admin/vite.config.ts`). */
const PORTA_ADMIN_DEV = "5173";

/** Porta do dev server do PDV (`apps/pdv/vite.config.ts`). */
const PORTA_PDV_DEV = "5174";

/**
 * Base do painel administrativo, sem barra no fim, ou `null` quando não há como
 * saber onde ele está.
 *
 * `VITE_ADMIN_URL` tem precedência sobre tudo: é a saída para quem hospeda os
 * dois apps em domínios que não seguem o padrão `pdv.`/`admin.`.
 */
export function adminBaseUrl(): string | null {
  const configurada = import.meta.env.VITE_ADMIN_URL;
  if (typeof configurada === "string" && configurada.trim()) {
    return configurada.trim().replace(/\/+$/, "");
  }

  // Sem janela (teste, SSR) não há origem de onde derivar.
  if (typeof window === "undefined") return null;

  const { protocol, hostname, port } = window.location;
  const sufixoPorta = port ? `:${port}` : "";

  // Produção: pdv.uaus.com.br -> admin.uaus.com.br. Só o primeiro rótulo é
  // trocado, então `pdv.uaus.com.br` e `pdv.homolog.uaus.com.br` funcionam
  // iguais, cada um apontando para o admin do seu próprio ambiente.
  if (/^pdv\./i.test(hostname)) {
    return `${protocol}//${hostname.replace(/^pdv\./i, "admin.")}${sufixoPorta}`;
  }

  // Desenvolvimento: os dois apps sobem no mesmo host, em portas diferentes.
  if (port === PORTA_PDV_DEV) {
    return `${protocol}//${hostname}:${PORTA_ADMIN_DEV}`;
  }

  // Host que não segue nenhum dos dois padrões: preview local, IP na rede da
  // loja, domínio próprio. Devolver a origem aqui reabriria o PDV; é melhor o
  // link sumir e alguém configurar VITE_ADMIN_URL.
  return null;
}

/** URL da tela inicial do painel, ou `null` quando o admin não é alcançável. */
export function adminHomeUrl(): string | null {
  const base = adminBaseUrl();
  return base === null ? null : `${base}/`;
}

/**
 * URL da tela de produtos do admin já filtrada no produto informado.
 *
 * A rota de produtos não recebe id na URL — a edição abre por modal depois da
 * busca. Levar o termo por query string é o que existe hoje para chegar perto do
 * produto sem inventar uma rota nova no admin.
 *
 * @param termo Código de barras ou nome, o que identificar melhor o produto.
 * @returns A URL, ou `null` quando o admin não é alcançável.
 */
export function adminProductSearchUrl(termo: string): string | null {
  const base = adminBaseUrl();
  return base === null ? null : `${base}/produtos?busca=${encodeURIComponent(termo)}`;
}

/**
 * Abre uma URL em nova aba com segurança. `null` não abre nada.
 *
 * `noopener` é o que importa: sem ele a página aberta recebe `window.opener` e
 * pode navegar a aba do PDV para outro lugar — com o caixa aberto e uma venda em
 * andamento na tela.
 *
 * @param url Endereço a abrir; `null` é ignorado, para o chamador poder repassar
 *   direto o retorno de {@link adminHomeUrl} sem repetir a checagem.
 */
export function openInNewTab(url: string | null): void {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
