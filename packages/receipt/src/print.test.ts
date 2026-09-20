import { afterEach, describe, expect, it, vi } from "vitest";
import { printReceiptHtml } from "./print";

/**
 * A impressão contra a tela em transição.
 *
 * REGRESSÃO do balcão (19/09/2026): finalizar uma venda fechava o diálogo de
 * pagamento e mandava imprimir na linha seguinte. `window.print()` bloqueia a
 * thread principal, e o `Presence` do Radix só desmonta um diálogo quando
 * recebe o `animationend` da animação de saída — **sem prazo de segurança**.
 * O evento morria com a thread travada e o diálogo ficava na tela para sempre:
 * visível, com o ESC morto e o clique de fora comido pelo overlay órfão.
 *
 * O que estes testes protegem é o único jeito de isso não voltar: a impressão
 * não monta o iframe enquanto houver animação de saída correndo.
 */

/** Uma animação como `document.getAnimations()` a devolve, com o controle na mão. */
function animacao(options: { infinita?: boolean; parada?: boolean } = {}) {
  let terminar: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    terminar = resolve;
  });

  return {
    terminar,
    animation: {
      playState: options.parada ? "idle" : "running",
      finished,
      effect: { getComputedTiming: () => ({ iterations: options.infinita ? Infinity : 1 }) },
    } as unknown as Animation,
  };
}

function comAnimacoes(lista: Animation[]) {
  document.getAnimations = (() => lista) as typeof document.getAnimations;
}

/** O iframe da impressão já está no DOM? É ele que denuncia se o print saiu. */
function iframeDaImpressao() {
  return document.getElementById("uaus-receipt-print-frame");
}

describe("printReceiptHtml", () => {
  afterEach(() => {
    vi.useRealTimers();
    iframeDaImpressao()?.remove();
    Reflect.deleteProperty(document, "getAnimations");
  });

  it("sem animação nenhuma, imprime sem esperar", async () => {
    vi.useFakeTimers();
    comAnimacoes([]);

    void printReceiptHtml("<html><body>cupom</body></html>");

    expect(iframeDaImpressao()).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(iframeDaImpressao()).not.toBeNull();
  });

  it("ESPERA a animação de saída antes de montar o iframe", async () => {
    // É este o caso do balcão: o diálogo de pagamento fechando.
    vi.useFakeTimers();
    const saindo = animacao();
    comAnimacoes([saindo.animation]);

    void printReceiptHtml("<html><body>cupom</body></html>");
    await vi.advanceTimersByTimeAsync(0);

    expect(iframeDaImpressao()).toBeNull();

    saindo.terminar();
    await vi.advanceTimersByTimeAsync(0);

    expect(iframeDaImpressao()).not.toBeNull();
  });

  it("não espera para sempre: o teto imprime assim mesmo", async () => {
    // Papel atrasado é pior que diálogo torto.
    vi.useFakeTimers();
    comAnimacoes([animacao().animation]);

    void printReceiptHtml("<html><body>cupom</body></html>");
    await vi.advanceTimersByTimeAsync(0);
    expect(iframeDaImpressao()).toBeNull();

    await vi.advanceTimersByTimeAsync(400);
    expect(iframeDaImpressao()).not.toBeNull();
  });

  it("ignora animação INFINITA — ela nunca terminaria", async () => {
    // O `animate-spin` do botão que está gravando a venda ainda está rodando
    // quando o cupom é montado; esperá-lo seria esperar o teto toda vez.
    vi.useFakeTimers();
    comAnimacoes([animacao({ infinita: true }).animation]);

    void printReceiptHtml("<html><body>cupom</body></html>");
    await vi.advanceTimersByTimeAsync(0);

    expect(iframeDaImpressao()).not.toBeNull();
  });

  it("ignora animação que não está correndo", async () => {
    vi.useFakeTimers();
    comAnimacoes([animacao({ parada: true }).animation]);

    void printReceiptHtml("<html><body>cupom</body></html>");
    await vi.advanceTimersByTimeAsync(0);

    expect(iframeDaImpressao()).not.toBeNull();
  });

  it("navegador sem `getAnimations` imprime do mesmo jeito", async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(document, "getAnimations");

    void printReceiptHtml("<html><body>cupom</body></html>");
    await vi.advanceTimersByTimeAsync(0);

    expect(iframeDaImpressao()).not.toBeNull();
  });
});
