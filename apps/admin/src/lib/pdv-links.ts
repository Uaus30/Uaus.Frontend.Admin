/**
 * Links para o PDV.
 *
 * Contraparte de `apps/pdv/src/lib/admin-links.ts`, que faz o caminho inverso.
 * A topologia é **um subdomínio por app**: admin em `admin.uaus.com.br`, PDV em
 * `pdv.uaus.com.br`.
 *
 * A ordem de resolução é: variável de ambiente, depois derivação do subdomínio,
 * depois o par de portas do ambiente de desenvolvimento. Não havendo nenhuma das
 * três, o módulo devolve `null` e quem chama **esconde o botão**.
 *
 * Cair em `window.location.origin` seria repetir o defeito que derrubou a
 * primeira versão do módulo do PDV: o link funcionava, abria uma aba, e a aba
 * era do próprio app de onde a pessoa clicou. Ninguém reporta isso como erro —
 * só reclama que "o botão não faz nada".
 *
 * Sair para o endereço FIXO de produção seria pior aqui do que lá: o admin roda
 * em dev na máquina de quem desenvolve, e um `pdv.uaus.com.br` cravado no código
 * abriria o caixa de PRODUÇÃO a partir do ambiente de teste.
 */

/** Porta do dev server do admin (`apps/admin/vite.config.ts`). */
const PORTA_ADMIN_DEV = "5173";

/** Porta do dev server do PDV (`apps/pdv/vite.config.ts`). */
const PORTA_PDV_DEV = "5174";

/**
 * Base do PDV, sem barra no fim, ou `null` quando não há como saber onde ele
 * está.
 *
 * `VITE_PDV_URL` tem precedência sobre tudo: é a saída para quem hospeda os dois
 * apps em domínios que não seguem o padrão `admin.`/`pdv.`.
 */
export function pdvBaseUrl(): string | null {
  const configurada = import.meta.env.VITE_PDV_URL;
  if (typeof configurada === "string" && configurada.trim()) {
    return configurada.trim().replace(/\/+$/, "");
  }

  // Sem janela (teste, SSR) não há origem de onde derivar.
  if (typeof window === "undefined") return null;

  const { protocol, hostname, port } = window.location;
  const sufixoPorta = port ? `:${port}` : "";

  // Produção: admin.uaus.com.br -> pdv.uaus.com.br. Só o primeiro rótulo é
  // trocado, então `admin.uaus.com.br` e `admin.homolog.uaus.com.br` funcionam
  // iguais, cada um apontando para o PDV do seu próprio ambiente.
  if (/^admin\./i.test(hostname)) {
    return `${protocol}//${hostname.replace(/^admin\./i, "pdv.")}${sufixoPorta}`;
  }

  // Desenvolvimento: os dois apps sobem no mesmo host, em portas diferentes.
  if (port === PORTA_ADMIN_DEV) {
    return `${protocol}//${hostname}:${PORTA_PDV_DEV}`;
  }

  // Host que não segue nenhum dos dois padrões: preview local, IP na rede da
  // loja, domínio próprio. Devolver a origem aqui reabriria o admin; é melhor o
  // botão sumir e alguém configurar VITE_PDV_URL.
  return null;
}

/**
 * URL da tela inicial do PDV, ou `null` quando o PDV não é alcançável.
 *
 * O consumidor é um `<a target="_blank">`, não um `window.open`: âncora de
 * verdade mantém clique do meio, ctrl+clique e "abrir em nova janela" do menu de
 * contexto — que é justamente como quem trabalha com as duas telas abertas o dia
 * inteiro navega. `rel="noopener"` continua obrigatório lá.
 */
export function pdvHomeUrl(): string | null {
  const base = pdvBaseUrl();
  return base === null ? null : `${base}/`;
}
