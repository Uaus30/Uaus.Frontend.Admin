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

/** O que o balcão sabe sobre o produto na hora de mandar editar. */
type ProdutoParaEditar = {
  id: number;
  name: string;
  /** Nome do GRUPO — é por ele que a lista do admin filtra. */
  groupName?: string | null;
};

/**
 * URL que abre a modal de edição do produto no admin.
 *
 * São dois parâmetros porque a tela do admin faz duas coisas distintas:
 *
 * - `busca` traz o produto para a página. A listagem é paginada e filtra por
 *   **grupo de produto** (`/ProductGroups?search=`), então o termo tem que ser o
 *   nome do grupo. A primeira versão mandava o código de barras, que pertence ao
 *   produto filho e nunca casa com grupo nenhum: a aba abria numa lista vazia.
 * - `editar` diz QUAL linha abrir. Sem ele o admin só filtrava, e a pessoa
 *   tinha que procurar e clicar de novo — com a venda parada no caixa.
 *
 * @param produto Produto selecionado no balcão.
 * @returns A URL, ou `null` quando o admin não é alcançável.
 */
export function adminProductEditUrl(produto: ProdutoParaEditar): string | null {
  const base = adminBaseUrl();
  if (base === null) return null;

  const termo = produto.groupName?.trim() || produto.name;
  const query = new URLSearchParams({ busca: termo, editar: String(produto.id) });
  return `${base}/produtos?${query}`;
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
