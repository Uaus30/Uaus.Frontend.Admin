import { useState } from "react";
import { useDebounce } from "@workspace/ui";
import { useSearchTaskCards } from "@workspace/api-client-react";

/**
 * useTaskSearch
 *
 * A caixa de busca global do quadro: o texto digitado vira consulta depois de
 * uma pausa de 300ms, e a lista de resultados inclui cartões arquivados e
 * finalizados antigos — é o jeito de achar o que não está mais na tela.
 */
export function useTaskSearch() {
  const [input, setInput] = useState("");
  const term = useDebounce(input.trim(), 300);

  const { data, isFetching } = useSearchTaskCards(term);

  return {
    input,
    setInput,
    clear: () => setInput(""),
    /** True enquanto há texto digitado — é quando a lista de resultados aparece. */
    isActive: input.trim().length > 0,
    /** True entre digitar e o servidor responder (inclui a pausa do debounce). */
    isSearching: isFetching || (input.trim().length > 0 && input.trim() !== term),
    results: data ?? [],
  };
}
