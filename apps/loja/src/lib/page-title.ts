import { useEffect } from "react";

/**
 * Título da aba por página, no padrão imperativo que o admin já usa
 * (`document.title` em efeito) — sem dependência de head manager para um site
 * de quatro rotas.
 *
 * @param title Título completo, ou `undefined` enquanto o dado carrega (mantém
 *   o título anterior em vez de piscar um genérico).
 */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
