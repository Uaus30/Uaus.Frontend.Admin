import { useQuery } from "@tanstack/react-query";
import { searchPdvProducts, type ProductPdvSearchDto } from "@workspace/api-client-react";
import { useSearchTerm } from "@/hooks/use-search-term";

export { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from "@/hooks/use-search-term";

/** Teto de resultados, igual ao da busca do balcão. */
const SEARCH_LIMIT = 20;

/** Estado e ações da busca de produtos da aba de geração de etiquetas. */
export interface LabelProductSearchState {
  /** Termo digitado, ligado direto ao campo. */
  search: string;
  setSearch: (value: string) => void;
  /** Dispara a busca AGORA (Enter/submit), inclusive com termo curto. */
  submit: () => void;
  /**
   * Põe o termo no campo e busca na hora. É o que a câmera usa quando o código
   * lido serve a mais de um produto: a escolha fica com a pessoa, na lista.
   */
  searchNow: (term: string) => void;
  /**
   * Esvazia o campo e descarta a busca na hora — o "x" do campo e o produto que
   * acabou de entrar no lote. A digitação pendente morre junto: sem termo, o
   * debounce não tem o que promover.
   */
  clear: () => void;
  /** Produtos da busca corrente. Vazio enquanto ninguém buscou. */
  results: ProductPdvSearchDto[];
  isSearching: boolean;
  /**
   * A busca FALHOU — servidor fora do ar, sessão vencida.
   *
   * Separado de "não achei" porque a tela dizia "Nenhum produto encontrado" para
   * um 502, e isso manda a pessoa procurar outro termo quando o problema é que
   * ninguém respondeu. Foi visto acontecendo com a API local desligada.
   */
  hasFailed: boolean;
  /**
   * Existe uma busca em vigor.
   *
   * Não é o mesmo que `results` vazio: antes da primeira busca a lista também
   * está vazia, e a tela precisa distinguir "ainda não procurei" de "procurei e
   * não existe" — senão ela abre afirmando que o catálogo não tem nada.
   */
  hasSearched: boolean;
}

/**
 * Busca de produtos da tela de etiquetas, com o comportamento da busca do PDV.
 *
 * **A tela abre vazia.** A versão anterior consultava `/Products` com o termo em
 * branco e listava os 8 primeiros produtos do catálogo — uma lista que ninguém
 * pediu, em ordem que não significa nada, e que ainda gastava uma requisição a
 * cada vez que a aba era aberta. Aqui nenhuma requisição sai sem termo.
 *
 * **Dois gatilhos, como no balcão** — os de `useSearchTerm`, que o catálogo
 * personalizado também usa.
 *
 * **A busca é a do balcão** (`GET /Pdv/products/search`) e não a listagem
 * paginada do cadastro. Os motivos são dois: ela interpreta o termo com a mesma
 * regra (dígitos = código de barras) e já devolve a URL da primeira imagem — que
 * é a miniatura que a lista exibe. De quebra, sai do `src/services/`, que o
 * CLAUDE.md congelou.
 */
export function useLabelProductSearch(): LabelProductSearchState {
  const { search, setSearch, activeTerm, submit, searchNow, clear } = useSearchTerm();

  const { data, isFetching, isError } = useQuery({
    queryKey: ["gondola-labels-product-search", activeTerm],
    queryFn: () => searchPdvProducts(activeTerm, SEARCH_LIMIT),
    enabled: activeTerm.length > 0,
  });

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
