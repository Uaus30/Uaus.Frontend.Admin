import { useGetCatalogPieces } from "@workspace/api-client-react";

/** Quantas peças a tela pede: cobre meses de uso, e o servidor mede todas numa consulta só. */
export const HISTORY_SIZE = 60;

/**
 * Estado da tela "Histórico do Catálogo".
 *
 * A lista é a das peças que SAÍRAM do admin — compartilhadas ou baixadas —,
 * cada uma com as unidades vendidas dos produtos dela antes e depois. A conta é
 * toda do servidor; a tela só mostra.
 */
export function useCatalogHistory() {
  const query = useGetCatalogPieces(HISTORY_SIZE);

  return {
    history: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
