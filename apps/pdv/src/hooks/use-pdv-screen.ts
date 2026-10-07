import { useSyncExternalStore } from "react";

/**
 * As três formas da tela do PDV.
 *
 * - `desk`: o balcão — monitor HD (1366×768), tablet e computador. Duas colunas,
 *   cabeçalho cheio.
 * - `phone-landscape`: celular deitado, a forma PREFERIDA do dono para a
 *   contingência (07/10/2026). Continua em duas colunas, porque largura há; o que
 *   falta é ALTURA (~390px), e por isso cabeçalho, busca e carrinho encolhem.
 * - `phone-portrait`: celular em pé. Uma coluna só, com a busca e o carrinho em
 *   vistas separadas e uma barra no pé com o total.
 */
export type PdvScreen = "desk" | "phone-landscape" | "phone-portrait";

/**
 * Abaixo desta largura é celular em pé — o mesmo corte de 768px que o resto do
 * monorepo chama de mobile (`useIsMobile` do `@workspace/ui`).
 */
const PHONE_MAX_WIDTH = 767;

/**
 * Abaixo desta altura é celular deitado.
 *
 * A largura sozinha não pega o celular deitado: um aparelho de 390×844 vira
 * 844×390, acima dos 768px, e cairia no layout do balcão — com 80px de
 * cabeçalho e 104px de busca numa tela de 390. A altura separa bem: o caixa da
 * loja (1366×768) tem ~650px úteis mesmo com as barras do navegador, e o tablet
 * deitado tem 768.
 */
const PHONE_MAX_HEIGHT = 500;

/**
 * Qual forma a tela tem, a partir do tamanho da janela.
 *
 * Função pura e exportada para o teste: é a regra que decide o layout inteiro,
 * e conferir cada aparelho no navegador custa mais do que uma tabela de casos.
 */
export function classifyScreen(width: number, height: number): PdvScreen {
  const phone = width <= PHONE_MAX_WIDTH || height <= PHONE_MAX_HEIGHT;
  if (!phone) return "desk";
  return width > height ? "phone-landscape" : "phone-portrait";
}

/**
 * Os cortes da regra, como consultas de mídia: avisam quando a tela ATRAVESSA
 * um deles.
 */
const BREAKPOINT_QUERIES = [
  `(max-width: ${PHONE_MAX_WIDTH}px)`,
  `(max-height: ${PHONE_MAX_HEIGHT}px)`,
  "(orientation: portrait)",
];

function subscribe(onChange: () => void) {
  // `resize` cobre o giro do aparelho. As consultas de mídia são a segunda via,
  // barata: avisam quando um corte é de fato atravessado, seja qual for o jeito
  // que o navegador entrega o `resize` no giro. (Num painel ou aba OCULTA nenhum
  // dos dois chega — o navegador só os dispara ao pintar —, e a forma se acerta
  // quando a tela volta a aparecer.)
  window.addEventListener("resize", onChange);
  const queries =
    typeof window.matchMedia === "function"
      ? BREAKPOINT_QUERIES.map((query) => window.matchMedia(query))
      : [];
  queries.forEach((query) => query.addEventListener("change", onChange));

  return () => {
    window.removeEventListener("resize", onChange);
    queries.forEach((query) => query.removeEventListener("change", onChange));
  };
}

/**
 * A forma da tela agora, e a cada giro do celular.
 *
 * Lê `innerWidth`/`innerHeight`, e não `matchMedia`: dá o valor certo no
 * primeiro render e funciona no jsdom dos testes, que não tem `matchMedia`.
 * O retorno é texto, então o React só renderiza de novo quando a FORMA muda — e
 * não a cada pixel de um redimensionamento.
 */
export function usePdvScreen(): PdvScreen {
  return useSyncExternalStore(
    subscribe,
    () => classifyScreen(window.innerWidth, window.innerHeight),
    () => "desk",
  );
}
