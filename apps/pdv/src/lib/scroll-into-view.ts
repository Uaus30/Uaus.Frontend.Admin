/**
 * Rolagem VERTICAL mínima para um elemento ficar inteiro à vista dentro do
 * ancestral rolável mais próximo.
 *
 * Existe no lugar de `scrollIntoView({ block: "nearest" })` por causa do eixo
 * horizontal: o `scrollIntoView` alinha nos DOIS eixos, e qualquer conteúdo
 * que passe da largura do viewport — mesmo por um `transform` de animação, que
 * também conta como área rolável — faz o navegador rolar a lista inteira para
 * o lado, cortando todas as linhas até a rolagem voltar. Foi o que o carrinho
 * do PDV fez em 02/09/2026: a linha nova nascia 20px à direita pela animação
 * de entrada, e cada bipe empurrava o carrinho inteiro para a esquerda.
 *
 * É o "nearest" à mão: quem já está à vista não mexe nada, quem está abaixo
 * sobe o mínimo, quem está acima desce o mínimo.
 *
 * @param element Linha que precisa ficar à vista, ou `null` (não faz nada).
 */
export function scrollIntoViewVertically(element: HTMLElement | null): void {
  if (!element) return;

  const scroller = nearestVerticalScroller(element);
  if (!scroller) return;

  const item = element.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();

  const delta =
    item.bottom > view.bottom ? item.bottom - view.bottom : item.top < view.top ? item.top - view.top : 0;
  if (delta === 0) return;

  // `scrollBy` suave onde existe; `scrollTop` existe em todo lugar (jsdom
  // inclusive) e é o caminho de reserva.
  if (typeof scroller.scrollBy === "function") {
    scroller.scrollBy({ top: delta, behavior: "smooth" });
  } else {
    scroller.scrollTop += delta;
  }
}

/** Ancestral mais próximo que rola na vertical (`overflow-y: auto` ou `scroll`). */
function nearestVerticalScroller(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;

  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }

  return null;
}
