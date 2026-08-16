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
}

/** Estado e ações da busca de produtos. */
export interface ProductSearchState {
  /** Termo digitado, ligado direto ao campo. */
  query: string;
  setQuery: (query: string) => void;
  /** Produtos encontrados na última busca concluída. */
  results: ProductPdvSearchDto[];
  /**
   * A última busca concluída não achou nada.
   *
   * Não é o mesmo que `results` vazio: antes da primeira busca a lista também
   * está vazia, e a tela precisa distinguir "ainda não procurei" de "procurei e
   * não existe" para escolher entre o painel ocioso e o aviso na lista.
   */
  notFound: boolean;
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
 *
 * Busca sem resultado **não** é erro e não vira aviso: ela sai por `notFound`,
 * que a tela mostra dentro da própria lista. O toast só cobre falha de verdade
 * (o servidor recusou, a base local não respondeu) — um toast vermelho para
 * "esse produto não existe" treinava o operador a dispensar aviso vermelho sem
 * ler, e é o mesmo aviso que carrega "estoque insuficiente".
 */
export function useProductSearch(options: UseProductSearchOptions): ProductSearchState {
  const { online, enabled = true } = options;
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductPdvSearchDto[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Os callbacks ficam numa ref para que `search` não troque de identidade a
  // cada render de quem chama. Sem isso, uma função declarada inline no
  // chamador reiniciaria o debounce a cada render e a busca nunca dispararia.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  /**
   * Número da busca mais recente.
   *
   * Sem ele existe uma corrida real no balcão: o operador digita, o debounce
   * dispara, ele limpa o campo antes de a resposta chegar — e a resposta antiga
   * repõe a lista que acabou de sumir. Toda escrita na tela confere se ainda é a
   * busca corrente.
   */
  const buscaAtualRef = useRef(0);

  /**
   * Abandona a busca corrente e apaga tudo que ela produziu na tela.
   *
   * Invalidar é o essencial: sem isso, limpar e receber a resposta anterior
   * traria a lista de volta sozinha. Desligar o indicador **aqui** é a outra
   * metade — a partir do incremento a busca em voo deixou de ser a corrente, e o
   * `finally` dela não desliga mais nada. Sem esta linha o spinner ficava girando
   * para sempre depois de cada bipe do leitor, que sai por este mesmo caminho.
   */
  const descartarBuscaCorrente = useCallback(() => {
    buscaAtualRef.current++;
    setResults([]);
    setNotFound(false);
    setIsSearching(false);
  }, []);

  const clear = useCallback(() => {
    descartarBuscaCorrente();
    setQuery("");
  }, [descartarBuscaCorrente]);

  /**
   * Atualiza o termo e, quando ele fica VAZIO, apaga a lista na hora.
   *
   * A limpeza mora aqui, no setter, e não num efeito sobre `query`: `setState`
   * síncrono dentro de efeito dispara render em cascata e o lint reprova. Além
   * disso é mais direto — quem apagou o campo já sabe que apagou.
   */
  const updateQuery = useCallback(
    (next: string) => {
      setQuery(next);

      if (next.trim().length === 0) descartarBuscaCorrente();
    },
    [descartarBuscaCorrente],
  );

  const search = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      const busca = ++buscaAtualRef.current;

      if (!trimmed) {
        setResults([]);
        setNotFound(false);
        return;
      }

      setIsSearching(true);
      try {
        const found = await searchProducts(trimmed, { online });

        // Chegou tarde: o operador já limpou o campo ou digitou outra coisa.
        // Escrever aqui seria mostrar resultado de uma busca que ele abandonou.
        if (busca !== buscaAtualRef.current) return;

        setResults(found);
        setNotFound(found.length === 0);

        // Leitura de código de barras: match exato e único não vira lista.
        const exact = found.filter((product) => (product.barcode ?? "").trim() === trimmed);
        if (exact.length === 1) {
          optionsRef.current.onExactBarcodeMatch?.(exact[0]);
          clear();
        }
      } catch (error) {
        if (busca !== buscaAtualRef.current) return;

        toast({
          title: "Erro na busca",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        // Só a busca corrente desliga o indicador; a antiga desligaria o spinner
        // de uma busca que ainda está rodando.
        if (busca === buscaAtualRef.current) setIsSearching(false);
      }
    },
    [clear, online, toast],
  );

  // Termo CURTO não limpa o que já está na tela: quem apaga uma letra para
  // corrigir continua vendo o resultado anterior em vez de uma lista que pisca.
  // Termo VAZIO é outra coisa, e é tratado em `updateQuery`: manter resultados
  // sem termo nenhum deixa a tela afirmando uma busca que não existe mais.
  useEffect(() => {
    if (!enabled) return;
    if (query.trim().length < MIN_SEARCH_LENGTH) return;

    const timer = setTimeout(() => void search(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, query, search]);

  return { query, setQuery: updateQuery, results, notFound, isSearching, search, clear };
}
