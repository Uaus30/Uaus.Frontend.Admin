import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollIntoViewVertically } from "./scroll-into-view";

type Box = { top: number; bottom: number };

/** Caixa com só o eixo vertical importando; o resto existe para o tipo fechar. */
function rect(box: Box): DOMRect {
  return {
    ...box,
    left: 0,
    right: 100,
    width: 100,
    height: box.bottom - box.top,
    x: 0,
    y: box.top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Monta um rolável com uma linha dentro, com as caixas que o caso pede. */
function montar(view: Box, line: Box) {
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  const element = document.createElement("div");
  scroller.appendChild(element);
  document.body.appendChild(scroller);

  vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue(rect(view));
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(line));

  const scrollBy = vi.fn();
  Object.defineProperty(scroller, "scrollBy", { value: scrollBy, configurable: true, writable: true });

  return { scroller, element, scrollBy };
}

describe("scrollIntoViewVertically", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sobe a lista o mínimo quando a linha está abaixo da área visível", () => {
    const { element, scrollBy } = montar({ top: 0, bottom: 400 }, { top: 380, bottom: 460 });

    scrollIntoViewVertically(element);

    expect(scrollBy).toHaveBeenCalledWith({ top: 60, behavior: "smooth" });
  });

  it("desce a lista o mínimo quando a linha está acima da área visível", () => {
    const { element, scrollBy } = montar({ top: 100, bottom: 500 }, { top: 40, bottom: 120 });

    scrollIntoViewVertically(element);

    expect(scrollBy).toHaveBeenCalledWith({ top: -60, behavior: "smooth" });
  });

  it("não mexe na lista quando a linha já está inteira à vista", () => {
    // Quem está conferindo o carrinho não pode perder a posição por um bipe.
    const { element, scrollBy } = montar({ top: 0, bottom: 400 }, { top: 100, bottom: 180 });

    scrollIntoViewVertically(element);

    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("nunca pede rolagem horizontal", () => {
    // É a razão de a função existir: o `scrollIntoView` alinhava nos dois
    // eixos e puxava o carrinho inteiro para a esquerda a cada bipe.
    const { element, scrollBy } = montar({ top: 0, bottom: 400 }, { top: 380, bottom: 460 });

    scrollIntoViewVertically(element);

    const [pedido] = scrollBy.mock.calls[0] as [ScrollToOptions];
    expect(pedido).not.toHaveProperty("left");
  });

  it("cai para scrollTop onde o navegador não tem scrollBy", () => {
    const { scroller, element } = montar({ top: 0, bottom: 400 }, { top: 380, bottom: 460 });
    Object.defineProperty(scroller, "scrollBy", { value: undefined, configurable: true });
    scroller.scrollTop = 10;

    scrollIntoViewVertically(element);

    expect(scroller.scrollTop).toBe(70);
  });

  it("não faz nada sem elemento ou sem ancestral rolável", () => {
    const solto = document.createElement("div");
    document.body.appendChild(solto);

    expect(() => scrollIntoViewVertically(null)).not.toThrow();
    expect(() => scrollIntoViewVertically(solto)).not.toThrow();
  });
});
