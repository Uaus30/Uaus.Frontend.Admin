import { STALE_TIME, USER_ROLE, enumCode, useGetMe } from "@workspace/api-client-react";

/**
 * Sessão do usuário logado.
 *
 * Fica fora do route-guards porque aquele arquivo só exporta componentes — é o
 * que o Fast Refresh exige para trocar a árvore sem recarregar a página.
 *
 * O staleTime de 5 minutos evita refazer a consulta a cada navegação: a sessão
 * não muda entre telas, e o guard consulta em toda rota.
 */
export function useSessao() {
  return useGetMe({ query: { retry: false, staleTime: STALE_TIME.catalogo } });
}

/**
 * O usuário logado é Administrador?
 *
 * Para AÇÃO restrita dentro de uma tela que os dois papéis abrem — a rota
 * inteira se protege com `roles` em `routes.ts`. Enquanto a sessão carrega a
 * resposta é `false`: a ação aparece depois, nunca antes. E quem decide de
 * verdade é a API, que recusa com 403; esconder o botão é só não oferecer o
 * que vai falhar.
 *
 * Normaliza com `enumCode` pelo mesmo motivo do `podeAcessar`: a API manda o
 * NOME do papel ("Admin"), não o código.
 */
export function useIsAdmin(): boolean {
  // Sem custo de rede: o `useGetMe` lê a sessão guardada no navegador.
  const { data: user } = useSessao();
  return user?.role != null && enumCode(user.role, USER_ROLE) === USER_ROLE.Admin;
}
