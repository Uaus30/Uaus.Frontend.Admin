import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { searchProducts } from "@/lib/product-search";
import { MIN_SEARCH_LENGTH, SEARCH_DEBOUNCE_MS } from "./use-debounced-value";

/** O que muda entre um chamador e outro da busca de produtos. */
export interface UseProductSearchOptions {
  /** A API está respondendo. Decide o caminho da busca (servidor ou base local). */
  online: boolean;
  /**
   * Liga o disparo automático pela digitação.
   *
   * O diálogo de baixa de estoque desliga enquanto está fechado: o termo
   * sobrevive ao fechamento e, sem isso, uma busca dispararia sozinha para uma
   * tela que ninguém está olhando.
   */
  enabled?: boolean;
  /**
   * O termo casou exatamente com o código de barras de **um** produto — é o
   * leitor bipando. Quem chama decide o destino: o carrinho no balcão, a lista
   * na baixa de estoque.
   */
  onExactBarcodeMatch?: (product: ProductPdvSearchDto) => void;
  /** A busca terminou sem nenhum produto. Só o balcão avisa o operador. */
  onEmptyResult?: (term: string) => void;
}

/** Estado e ações da busca de produtos. */
export interface ProductSearchState {
  /** Termo digitado, ligado direto ao campo. */
  query: string;
  setQuery: (query: string) => void;
  /** Produtos encontrados na última busca concluída. */
  results: ProductPdvSearchDto[];
  /** Uma busca está em andamento. */
  isSearching: boolean;
  /** Dispara a busca agora (submit do formulário, Enter, botão BUSCAR). */
  search: (query: string) => Promise<void>;
  /** Esvazia campo e resultados — depois de escolher um produto ou fechar a venda. */
  clear: () => void;
}

/**
 * Busca de produtos do balcão e da baixa de estoque: estado do campo, disparo
 * por digitação e leitura de código de barras.
 *
 * Existia duas vezes, quase igual, na tela do PDV e no diálogo de baixa —
 * inclusive o `try/catch` que vira toast. O que de fato mudava entre as duas era
 * só o destino do produto bipado, que agora entra por callback.
 *
 * A busca em si (e o fallback para a base local quando a API não responde) mora
 * em `lib/product-search.ts`; aqui fica o que é de tela.
 *
 * Uma leitura de código de barras — termo que casa exatamente com **um**
 * produto — não passa pela lista de resultados: o produto vai direto para o
 * destino e o campo é limpo, para o operador bipar o próximo sem tirar a mão do
 * leitor.
 */
export function useProductSearch(options: UseProductSearchOptions): ProductSearchState {
  const { online, enabled = true } = options;
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPdvSearchDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Os callbacks ficam numa ref para que `search` não troque de identidade a
  // cada render de quem chama. Sem isso, uma função declarada inline no
  // chamador reiniciaria o debounce a cada render e a busca nunca dispararia.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
  }, []);

  const search = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const found = await searchProducts(trimmed, { online });
        setResults(found);

        // Leitura de código de barras: match exato e único não vira lista.
        const exact = found.filter((product) => (product.barcode ?? "").trim() === trimmed);
        if (exact.length === 1) {
          optionsRef.current.onExactBarcodeMatch?.(exact[0]);
          clear();
          return;
        }

        if (found.length === 0) optionsRef.current.onEmptyResult?.(trimmed);
      } catch (error) {
        toast({
          title: "Erro na busca",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        setIsSearching(false);
      }
    },
    [clear, online, toast],
  );

  // Termo curto não limpa o que já está na tela: o operador que apaga uma letra
  // para corrigir continua vendo o resultado anterior em vez de uma lista que
  // pisca.
  useEffect(() => {
    if (!enabled) return;
    if (query.trim().length < MIN_SEARCH_LENGTH) return;

    const timer = setTimeout(() => void search(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, query, search]);

  return { query, setQuery, results, isSearching, search, clear };
}
