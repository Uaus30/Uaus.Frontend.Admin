import { createContext, useContext, useEffect } from "react";

/** Anuncia (ou retira) o título específico da tela em foco. */
type Anunciar = (titulo: string | null) => void;

/**
 * Canal entre a tela e o `PageTitleProvider`.
 *
 * Mora aqui, e não ao lado do provedor, porque um arquivo que exporta
 * componente só pode exportar componentes — é o que o Fast Refresh exige
 * (`react-refresh/only-export-components`). O provedor importa este contexto;
 * a tela usa o `usePageTitle` abaixo e nunca toca no contexto direto.
 */
export const PageTitleContext = createContext<Anunciar>(() => {});

/**
 * Dá à tela um título mais específico que o nome da rota.
 *
 * @param titulo O que a tela quer mostrar, ou `undefined`/`null` para voltar ao
 *   nome da rota. Passar o valor que ainda está carregando como `undefined`
 *   mantém o título anterior em vez de piscar um genérico.
 */
export function usePageTitle(titulo?: string | null): void {
  const anunciar = useContext(PageTitleContext);

  useEffect(() => {
    anunciar(titulo ?? null);
    return () => anunciar(null);
  }, [titulo, anunciar]);
}
