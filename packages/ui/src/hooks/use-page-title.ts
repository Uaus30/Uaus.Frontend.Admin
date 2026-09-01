import { useEffect } from "react";

/**
 * Título da aba, por tela.
 *
 * Escreve em `document.title` num efeito, sem head manager: os três apps somam
 * poucas rotas e nenhum deles renderiza no servidor, então uma dependência a
 * mais para escrever uma string não se paga.
 *
 * O título importa mais do que parece porque é o que o **histórico do navegador**
 * mostra. Com um título fixo no `index.html`, o histórico do admin listava vinte
 * e cinco telas diferentes como "Painel Administrativo" — e voltar para "aquela
 * tela de ontem" virava adivinhação.
 *
 * @param title Título completo, ou `undefined` enquanto o dado carrega — nesse
 *   caso o título anterior FICA, em vez de piscar um genérico. É o que evita a
 *   aba mostrar "Uaus" por um instante entre a rota abrir e o produto chegar.
 */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
