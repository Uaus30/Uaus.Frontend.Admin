import { STALE_TIME, useGetMe } from "@workspace/api-client-react";

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
