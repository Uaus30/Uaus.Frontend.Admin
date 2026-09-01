import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchPdvProducts, type ProductPdvSearchDto } from "@workspace/api-client-react";

/**
 * Espera, em milissegundos, entre a última tecla e a busca.
 *
 * O par 400ms / 3 caracteres é o MESMO da busca do balcão
 * (`apps/pdv/src/features/pdv/hooks/use-debounced-value.ts`, que traz a
 * derivação dos números). Aqui ele foi adotado por pedido explícito: é a mesma
 * pessoa que opera o caixa e monta o lote de etiquetas, e duas buscas de produto
 * que "respondem diferente" no mesmo sistema são uma diferença que ninguém
 * consegue explicar no balcão.
 */
export const SEARCH_DEBOUNCE_MS = 400;

/** Caracteres mínimos para a digitação disparar a busca sozinha. */
export const MIN_SEARCH_LENGTH = 3;

/** Teto de resultados, igual ao da busca do balcão. */
const SEARCH_LIMIT = 20;

/** Estado e ações da busca de produtos da aba de geração de etiquetas. */
export interface LabelProductSearchState {
  /** Termo digitado, ligado direto ao campo. */
  search: string;
  setSearch: (value: string) => void;
  /** Dispara a busca AGORA (Enter/submit), inclusive com termo curto. */
  submit: () => void;
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
 * **Dois gatilhos, como no balcão.** A digitação dispara sozinha a partir de
 * {@link MIN_SEARCH_LENGTH} caracteres, depois de {@link SEARCH_DEBOUNCE_MS} sem
 * teclar; o Enter dispara na hora e é a única saída para um termo mais curto que
 * isso ("kg", "chá").
 *
 * **A busca é a do balcão** (`GET /Pdv/products/search`) e não a listagem
 * paginada do cadastro. Os motivos são três: ela interpreta o termo com a mesma
 * regra (dígitos = código de barras), já devolve a URL da primeira imagem — que
 * é a miniatura que a lista exibe — e é liberada para `Seller`, enquanto
 * `/Products` não é. De quebra, sai do `src/services/`, que o CLAUDE.md congelou.
 *
 * Termo CURTO não limpa o que já está na tela: quem apaga uma letra para
 * corrigir continua vendo o resultado anterior em vez de uma lista que pisca.
 * Termo VAZIO limpa na hora — manter resultados sem termo nenhum deixaria a tela
 * afirmando uma busca que não existe mais.
 */
export function useLabelProductSearch(): LabelProductSearchState {
  const [search, setSearch] = useState("");
  /** Termo efetivamente consultado. É ele, e não o campo, que aciona a query. */
  const [activeTerm, setActiveTerm] = useState("");

  // O debounce é um `setTimeout` no efeito, e não o `useDebounce` do kit, pelo
  // mesmo motivo que no PDV: promover o valor com `setState` SÍNCRONO dentro do
  // efeito dispara render em cascata, e o lint do repositório trata isso como
  // erro. Dentro do timer o `setState` é assíncrono e o encadeamento some.
  useEffect(() => {
    const termo = search.trim();
    if (termo.length < MIN_SEARCH_LENGTH) return;

    const timer = setTimeout(() => setActiveTerm(termo), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  /**
   * Atualiza o campo e, quando ele fica VAZIO, descarta a busca na hora.
   *
   * A limpeza mora aqui e não no efeito acima porque o efeito só promove o termo
   * DEPOIS da espera: esvaziar o campo deixaria a lista antiga na tela por mais
   * 400ms, tempo de sobra para alguém clicar em "+" no produto errado.
   */
  const updateSearch = useCallback((next: string) => {
    setSearch(next);
    if (next.trim().length === 0) setActiveTerm("");
  }, []);

  const submit = useCallback(() => setActiveTerm(search.trim()), [search]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["gondola-labels-product-search", activeTerm],
    queryFn: () => searchPdvProducts(activeTerm, SEARCH_LIMIT),
    enabled: activeTerm.length > 0,
  });

  const hasSearched = activeTerm.length > 0;

  return {
    search,
    setSearch: updateSearch,
    submit,
    results: hasSearched ? (data ?? []) : [],
    isSearching: hasSearched && isFetching,
    hasFailed: hasSearched && isError,
    hasSearched,
  };
}
