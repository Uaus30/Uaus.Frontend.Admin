import { useSearchCatalogProducts, type CatalogSearchItemDto } from "@workspace/api-client-react";
import { useSearchTerm } from "@/hooks/use-search-term";

/** Teto de resultados, igual ao da busca do balcão e das etiquetas. */
const SEARCH_LIMIT = 20;

/** Estado e ações da busca de produtos da aba Personalizado. */
export interface CatalogProductSearchState {
  search: string;
  setSearch: (value: string) => void;
  /** Dispara a busca AGORA (Enter), inclusive com termo curto. */
  submit: () => void;
  /** Põe o termo no campo e busca na hora — o código lido pela câmera. */
  searchNow: (term: string) => void;
  /** Esvazia o campo e a lista na hora. */
  clear: () => void;
  /** Cadastros da busca corrente, inclusive os que não podem entrar. Vazio sem busca. */
  results: CatalogSearchItemDto[];
  isSearching: boolean;
  /** A busca FALHOU — diferente de não ter achado nada. */
  hasFailed: boolean;
  /** Existe uma busca em vigor: separa "ainda não procurei" de "não achei". */
  hasSearched: boolean;
}

/**
 * A busca da peça personalizada: os gatilhos das Etiquetas e do balcão
 * (`useSearchTerm`), sobre `GET /Catalogs/products`, que procura por CADASTRO e
 * diz por que cada um não pode entrar.
 *
 * A tela abre vazia: nenhuma requisição sai sem termo.
 */
export function useCatalogProductSearch(): CatalogProductSearchState {
  const { search, setSearch, activeTerm, submit, searchNow, clear } = useSearchTerm();
  const { data, isFetching, isError } = useSearchCatalogProducts(activeTerm, SEARCH_LIMIT);

  const hasSearched = activeTerm.length > 0;

  return {
    search,
    setSearch,
    submit,
    searchNow,
    clear,
    results: hasSearched ? (data ?? []) : [],
    isSearching: hasSearched && isFetching,
    hasFailed: hasSearched && isError,
    hasSearched,
  };
}
