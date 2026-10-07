import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { classifyScreen, usePdvScreen } from "./use-pdv-screen";

describe("classifyScreen", () => {
  it.each([
    // O caixa da loja, com e sem as barras do navegador: continua o balcão.
    [1366, 768, "desk"],
    [1366, 657, "desk"],
    // Tablet nas duas orientações: há altura e largura para as duas colunas.
    [768, 1024, "desk"],
    [1024, 768, "desk"],
    // Celular em pé.
    [390, 844, "phone-portrait"],
    [360, 740, "phone-portrait"],
    // Celular deitado: largura de sobra, altura de celular. A largura sozinha
    // jogaria estes no balcão, com 184px de cabeçalho e busca numa tela de 390.
    [844, 390, "phone-landscape"],
    [932, 430, "phone-landscape"],
    [740, 360, "phone-landscape"],
  ] as const)("%i×%i é %s", (width, height, expected) => {
    expect(classifyScreen(width, height)).toBe(expected);
  });
});

describe("usePdvScreen", () => {
  const original = { width: window.innerWidth, height: window.innerHeight };

  const resizeTo = (width: number, height: number) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
    window.dispatchEvent(new Event("resize"));
  };

  afterEach(() => resizeTo(original.width, original.height));

  it("troca de forma quando o celular gira", () => {
    resizeTo(390, 844);
    const { result } = renderHook(() => usePdvScreen());
    expect(result.current).toBe("phone-portrait");

    act(() => resizeTo(844, 390));
    expect(result.current).toBe("phone-landscape");

    act(() => resizeTo(1366, 768));
    expect(result.current).toBe("desk");
  });
});
