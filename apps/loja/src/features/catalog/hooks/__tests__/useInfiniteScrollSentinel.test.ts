import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInfiniteScrollSentinel } from "../useInfiniteScrollSentinel";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

/** Dublê de IntersectionObserver: jsdom não implementa o de verdade. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(public callback: ObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  disconnect() {
    this.disconnected = true;
  }
}

describe("useInfiniteScrollSentinel", () => {
  afterEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it("pede a próxima página quando o sentinela entra na área observada", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const onLoadMore = vi.fn();

    const { result } = renderHook(() => useInfiniteScrollSentinel({ enabled: true, onLoadMore }));
    result.current(document.createElement("div"));

    const observer = FakeIntersectionObserver.instances[0];
    expect(observer.observed).toHaveLength(1);

    observer.callback([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Entrada sem interseção (saiu da tela) não dispara nada.
    observer.callback([{ isIntersecting: false }]);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("não observa nada quando desabilitado — página em voo não pode pedir outra", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    const onLoadMore = vi.fn();

    const { result } = renderHook(() => useInfiniteScrollSentinel({ enabled: false, onLoadMore }));
    result.current(document.createElement("div"));

    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("desconecta o observer anterior ao receber um novo nó", () => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

    const { result } = renderHook(() => useInfiniteScrollSentinel({ enabled: true, onLoadMore: vi.fn() }));
    result.current(document.createElement("div"));
    result.current(document.createElement("div"));

    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
    expect(FakeIntersectionObserver.instances[1].disconnected).toBe(false);
  });

  it("vira no-op onde IntersectionObserver não existe, sem quebrar a página", () => {
    const onLoadMore = vi.fn();

    const { result } = renderHook(() => useInfiniteScrollSentinel({ enabled: true, onLoadMore }));

    expect(() => result.current(document.createElement("div"))).not.toThrow();
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
