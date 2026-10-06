import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LG_BREAKPOINT, useNarrowerThan } from "../use-narrower-than";

const larguraOriginal = window.innerWidth;

function naLargura(largura: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: largura });
}

afterEach(() => {
  naLargura(larguraOriginal);
  vi.unstubAllGlobals();
});

describe("useNarrowerThan", () => {
  it("é verdadeiro só abaixo da largura — no limite exato já é a tabela", () => {
    naLargura(375);
    expect(renderHook(() => useNarrowerThan(LG_BREAKPOINT)).result.current).toBe(true);

    naLargura(LG_BREAKPOINT);
    expect(renderHook(() => useNarrowerThan(LG_BREAKPOINT)).result.current).toBe(false);
  });

  it("funciona sem matchMedia (o jsdom não tem)", () => {
    vi.stubGlobal("matchMedia", undefined);
    naLargura(375);

    expect(renderHook(() => useNarrowerThan(LG_BREAKPOINT)).result.current).toBe(true);
  });

  it("acompanha a janela quando ela cruza a largura (o celular deitado)", () => {
    let avisar = () => {};
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: (_: string, listener: () => void) => {
          avisar = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );
    naLargura(375);
    const { result } = renderHook(() => useNarrowerThan(LG_BREAKPOINT));
    expect(result.current).toBe(true);

    naLargura(1280);
    act(() => avisar());

    expect(result.current).toBe(false);
  });
});
