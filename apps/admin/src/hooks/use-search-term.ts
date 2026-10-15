import { useCallback, useEffect, useState } from "react";

/**
 * Espera, em milissegundos, entre a última tecla e a busca.
 *
 * O par 400ms / 3 caracteres é o MESMO da busca do balcão
 * (`apps/pdv/src/features/pdv/hooks/use-debounced-value.ts`, que traz a
 * derivação dos números). É a mesma pessoa que opera o caixa, monta o lote de
 * etiquetas e escolhe os produtos do catálogo: duas buscas de produto que
 * "respondem diferente" no mesmo sistema são uma diferença que ninguém consegue
 * explicar no balcão.
 */
export const SEARCH_DEBOUNCE_MS = 400;

/** Caracteres mínimos para a digitação disparar a busca sozinha. */
export const MIN_SEARCH_LENGTH = 3;

/** O termo do campo e o termo em vigor — é este, e não o campo, que vai à rede. */
export interface SearchTermState {
  /** Termo digitado, ligado direto ao campo. */
  search: string;
  /** Atualiza o campo; vazio descarta a busca na hora. */
  setSearch: (value: string) => void;
  /** Termo efetivamente consultado. Vazio = nenhuma busca em vigor. */
  activeTerm: string;
  /** Dispara a busca AGORA (Enter/submit), inclusive com termo curto. */
  submit: () => void;
  /** Põe o termo no campo e busca na hora — o código lido pela câmera. */
  searchNow: (term: string) => void;
  /**
   * Esvazia o campo e descarta a busca na hora — o "x" do campo e o produto que
   * acabou de entrar na lista. A digitação pendente morre junto.
   */
  clear: () => void;
}

/**
 * Os gatilhos da busca de produtos do admin, iguais aos do balcão: a digitação
 * dispara sozinha a partir de {@link MIN_SEARCH_LENGTH} caracteres, depois de
 * {@link SEARCH_DEBOUNCE_MS} sem teclar; o Enter dispara na hora e é a única
 * saída para um termo mais curto que isso ("kg", "chá").
 *
 * Subiu da tela de Etiquetas em 15/10/2026, quando o catálogo personalizado
 * passou a precisar da mesma busca — feature não importa de feature.
 *
 * Termo CURTO não limpa o que já está na tela: quem apaga uma letra para
 * corrigir continua vendo o resultado anterior em vez de uma lista que pisca.
 * Termo VAZIO limpa na hora — manter resultados sem termo nenhum deixaria a tela
 * afirmando uma busca que não existe mais.
 */
export function useSearchTerm(): SearchTermState {
  const [search, setSearch] = useState("");
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

  const searchNow = useCallback((term: string) => {
    setSearch(term);
    setActiveTerm(term.trim());
  }, []);

  const clear = useCallback(() => updateSearch(""), [updateSearch]);

  return { search, setSearch: updateSearch, activeTerm, submit, searchNow, clear };
}
