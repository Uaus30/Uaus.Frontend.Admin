import { useCallback, useSyncExternalStore } from "react";

/** O `lg` do Tailwind: abaixo dele o admin troca tabela larga por cartões. */
export const LG_BREAKPOINT = 1024;

/**
 * `true` enquanto a janela for mais estreita que `width` pixels.
 *
 * Existe para a troca de TABELA por CARTÕES que não pode ser feita só com CSS:
 * quando as duas versões têm campos com `id` (o foco no campo com erro procura
 * por `id`), renderizar as duas e esconder uma deixaria ids repetidos, e o foco
 * cairia no campo escondido. Onde não há `id`, prefira `hidden lg:table-cell` e
 * `lg:hidden` — não custa render nenhum.
 *
 * O `useIsMobile` do kit é o mesmo desenho preso em 768px (o corte da barra
 * lateral). Aqui a largura é parâmetro porque a tabela das variações não cabe
 * nem com a barra aberta num tablet: a troca é no `lg`.
 *
 * Lê `innerWidth` (e não `matchMedia(...).matches`) para dar o valor certo já no
 * primeiro render e funcionar no jsdom, que não tem `matchMedia`.
 */
export function useNarrowerThan(width: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(`(max-width: ${width - 0.02}px)`);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [width],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < width,
    () => false,
  );
}
