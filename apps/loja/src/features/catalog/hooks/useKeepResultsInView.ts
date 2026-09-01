import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Folga acima da grade quando a correção precisa acontecer: as 6rem do
 * cabeçalho grudado mais um respiro, para o primeiro card não nascer colado
 * nele.
 */
export const RESULTS_TOP_GAP = 112;

/**
 * Quanto de grade precisa sobrar na tela para a posição ainda valer. Abaixo
 * disso o visitante está olhando rodapé, não produto.
 */
export const MIN_RESULTS_VISIBLE = 200;

/**
 * Mantém o visitante onde ele está ao trocar de filtro.
 *
 * Trocar de departamento NÃO sobe mais a página. A lista de filtros é grudada
 * e fica na altura dos primeiros produtos, então subir tirava o visitante do
 * lugar sem ganhar nada: no topo, o cabeçalho, o banner e a busca ocupam a
 * tela inteira antes do primeiro card.
 *
 * Tirar o `scrollTo(0)` não bastava, e é por isso que este hook existe em vez
 * de uma linha a menos na página. São dois efeitos colaterais para segurar:
 *
 * 1. **O navegador sobe a página sozinho enquanto a lista nova está em voo.**
 *    No carregando, a coluna vira um spinner de duzentos pixels, o documento
 *    encolhe e o scroll é grudado no novo fim. Por isso a altura medida na
 *    última lista volta como `min-height` NO RENDER do carregando: precisa
 *    estar no mesmo commit que troca a grade pelo spinner. Segurar isso num
 *    efeito é tarde demais — quando o efeito roda, o documento já encolheu e o
 *    navegador já mexeu no scroll.
 * 2. **A lista nova pode ser mais curta que a posição atual.** Filtrar
 *    "Inverno" (1 produto) estando na altura do produto 200 deixaria o
 *    visitante olhando o rodapé, com a grade inteira acima da tela — beco sem
 *    saída pior que o pulo para o topo. Aí o hook puxa até o ponto mais baixo
 *    que ainda mostra produto. Ele só sobe a página, nunca desce: descer seria
 *    inventar uma posição que o visitante não pediu. E só entra em cena quando
 *    quase não sobrou grade na tela: enquanto o visitante ainda vê produto, a
 *    posição dele é boa e mexer nela seria o mesmo pulo de antes, menor.
 *
 * A coluna vem de fora, na `ref` — quem renderiza é a página. `resultsKey` é o
 * que marca "a lista renderizada mudou" — na vitrine, o array
 * de produtos. Rodar de novo a cada página do scroll infinito é inofensivo: a
 * grade só cresce, e grade maior nunca cai na correção.
 *
 * `enabled` separa os dois momentos: `false` enquanto a lista nova está em voo
 * (segura a altura), `true` quando ela chegou (mede e corrige).
 */
export function useKeepResultsInView(
  ref: RefObject<HTMLDivElement | null>,
  resultsKey: unknown,
  enabled = true,
): CSSProperties | undefined {
  // Altura da última lista que esteve na tela. É estado, e não ref, porque
  // precisa entrar no HTML do render seguinte — ver o motivo 1 acima.
  const [lastHeight, setLastHeight] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    const columnRect = node.getBoundingClientRect();
    // Altura zero é coluna que ainda não existe. Medir aqui daria um topo falso
    // e jogaria a página para cima à toa.
    if (columnRect.height === 0) return;
    setLastHeight(columnRect.height);

    // A conta olha a GRADE, não a coluna inteira: depois dela ainda vêm o
    // sentinela e o "isso é tudo por enquanto", uns duzentos pixels que não são
    // produto — contá-los faria o hook achar que o visitante ainda vê a lista
    // quando ele já está no rodapé. Sem grade na tela (vazio, erro), vale a
    // coluna, que aí é a própria mensagem.
    const results = node.querySelector<HTMLElement>("[data-catalog-results]") ?? node;
    const rect = results.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const bottom = top + rect.height;
    // O ponto mais baixo que ainda mostra produto: o fim da grade encostado no
    // rodapé da tela ou, quando ela é curta demais para encher a tela, o
    // começo dela logo abaixo do cabeçalho.
    const lastUseful = Math.max(top - RESULTS_TOP_GAP, bottom - window.innerHeight);
    const stillShowsResults = window.scrollY <= bottom - MIN_RESULTS_VISIBLE;

    if (!stillShowsResults && window.scrollY > lastUseful) window.scrollTo({ top: lastUseful });
  }, [ref, resultsKey, enabled]);

  return enabled || lastHeight === 0 ? undefined : { minHeight: lastHeight };
}
