import { useCallback, useEffect, useRef } from "react";

/**
 * Antecedência com que a próxima página é pedida, antes de o sentinela entrar
 * na tela. Grande de propósito: a página chega antes de o visitante alcançar o
 * fim da grade e o scroll nunca "bate" num carregando.
 */
export const SENTINEL_ROOT_MARGIN = "600px 0px";

export interface InfiniteScrollSentinelOptions {
  /** Só observa quando há próxima página e nada em voo. */
  enabled: boolean;
  onLoadMore: () => void;
}

/**
 * Ref callback para o elemento sentinela do scroll infinito.
 *
 * `IntersectionObserver` em vez de listener de scroll: dispara só quando o
 * sentinela se aproxima da viewport, sem executar handler a cada pixel rolado —
 * numa grade que cresce, o listener de scroll é exatamente o tipo de custo que
 * se acumula. Sem suporte a IntersectionObserver (jsdom, browsers antigos), o
 * hook vira no-op e o visitante ainda navega pela paginação natural do layout.
 */
export function useInfiniteScrollSentinel(
  options: InfiniteScrollSentinelOptions,
): (node: HTMLElement | null) => void {
  const observerRef = useRef<IntersectionObserver | null>(null);

  // O callback mais recente, sem recriar o observer a cada render. A escrita
  // fica num efeito (e não no corpo do render) porque ref não pode ser tocada
  // durante o render — regra do react-hooks v7.
  const onLoadMoreRef = useRef(options.onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = options.onLoadMore;
  });

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || !options.enabled || typeof IntersectionObserver === "undefined") return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            onLoadMoreRef.current();
          }
        },
        { rootMargin: SENTINEL_ROOT_MARGIN },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [options.enabled],
  );
}
