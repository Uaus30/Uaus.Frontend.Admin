import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { comporTitulo, nomeDaTela } from "@/lib/route-title";

/**
 * Título da aba do admin: um por rota, com exceção por tela quando ela tem algo
 * mais específico a dizer.
 *
 * ## Por que existe um contexto, e não só um efeito em cada página
 *
 * O caminho óbvio — a página escreve `document.title` num efeito — quebra por
 * ORDEM. Efeito de filho roda antes de efeito de pai: numa navegação, a página
 * escreveria "BACIA COM TAMPA TRITEC" e o efeito do provedor, logo depois,
 * sobrescreveria com "Produtos". O título certo apareceria por um frame e
 * sumiria, sem erro nenhum na tela.
 *
 * Aqui a página não escreve o título: ela ANUNCIA o dela, e um único efeito —
 * o deste provedor — decide. O específico ganha do da rota porque é ele que a
 * página pediu; sem página nenhuma pedindo, vale o `label` do `routes.ts`.
 *
 * A limpeza é no desmonte (`return () => anunciar(null)`), e é o que faz a
 * navegação funcionar sozinha: a página que sai limpa antes de a que entra
 * anunciar, porque o React roda a limpeza da árvore que desmonta antes dos
 * efeitos da que monta.
 */

/** Anuncia (ou retira) o título específico da tela em foco. */
type Anunciar = (titulo: string | null) => void;

const PageTitleContext = createContext<Anunciar>(() => {});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [especifico, setEspecifico] = useState<string | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    document.title = comporTitulo(especifico ?? nomeDaTela(location));
  }, [especifico, location]);

  return <PageTitleContext.Provider value={setEspecifico}>{children}</PageTitleContext.Provider>;
}

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
