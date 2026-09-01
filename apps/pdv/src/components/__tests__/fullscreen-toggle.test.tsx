import { screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FullscreenToggle } from "../fullscreen-toggle";
import { renderWithHints } from "@/test/render-with-hints";

/** Instala a API de tela cheia do navegador no jsdom, que não a implementa. */
function givenFullscreenApi({ suportado = true } = {}) {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  const exitFullscreen = vi.fn().mockResolvedValue(undefined);

  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: suportado ? requestFullscreen : undefined,
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null, writable: true });

  return { requestFullscreen, exitFullscreen };
}

/** Simula o navegador entrando (ou saindo) da tela cheia por fora do botão. */
function whenBrowserFullscreenChanges(element: Element | null) {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: element });
  act(() => {
    document.dispatchEvent(new Event("fullscreenchange"));
  });
}

describe("FullscreenToggle", () => {
  beforeEach(() => givenFullscreenApi());

  afterEach(() => vi.restoreAllMocks());

  it("deve pedir tela cheia ao navegador", () => {
    const { requestFullscreen } = givenFullscreenApi();
    renderWithHints(<FullscreenToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar em tela cheia" }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("deve oferecer a saída depois que o navegador entra em tela cheia", () => {
    const { exitFullscreen } = givenFullscreenApi();
    renderWithHints(<FullscreenToggle />);

    // Quem manda é o `document.fullscreenElement`: o operador pode ter entrado
    // pelo F11, sem passar pelo botão, e o rótulo tem que acompanhar.
    whenBrowserFullscreenChanges(document.documentElement);

    fireEvent.click(screen.getByRole("button", { name: "Sair da tela cheia" }));

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("deve voltar a oferecer a entrada quando o operador sai pelo Esc", () => {
    // O Esc sai da tela cheia sem avisar o React. Sem ouvir o evento, o botão
    // continuaria oferecendo "sair" de um modo em que ninguém mais está.
    renderWithHints(<FullscreenToggle />);
    whenBrowserFullscreenChanges(document.documentElement);
    expect(screen.getByRole("button", { name: "Sair da tela cheia" })).toBeTruthy();

    whenBrowserFullscreenChanges(null);

    expect(screen.getByRole("button", { name: "Entrar em tela cheia" })).toBeTruthy();
  });

  it("não deve aparecer em navegador sem tela cheia", () => {
    // Um botão que não faz nada ensina o operador a desconfiar dos outros.
    givenFullscreenApi({ suportado: false });

    renderWithHints(<FullscreenToggle />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
