import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAROUSEL_AUTOPLAY_MS, CAROUSEL_SWIPE_THRESHOLD_PX, useCarousel } from "../useCarousel";

describe("useCarousel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("avança sozinho no intervalo do autoplay e dá a volta no fim", () => {
    const { result } = renderHook(() => useCarousel(3));

    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS));
    expect(result.current.index).toBe(1);

    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS * 2));
    expect(result.current.index).toBe(0);
  });

  it("pausa e retoma o autoplay — a foto que a pessoa está olhando não pode fugir", () => {
    const { result } = renderHook(() => useCarousel(3));

    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS * 3));
    expect(result.current.index).toBe(0);

    act(() => result.current.resume());
    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS));
    expect(result.current.index).toBe(1);
  });

  it("navega manualmente com aritmética modular nos dois sentidos", () => {
    const { result } = renderHook(() => useCarousel(3));

    act(() => result.current.prev());
    expect(result.current.index).toBe(2);

    act(() => result.current.next());
    expect(result.current.index).toBe(0);

    act(() => result.current.goTo(5));
    expect(result.current.index).toBe(2);
  });

  it("reinicia o relógio do autoplay após interação manual", () => {
    const { result } = renderHook(() => useCarousel(3));

    // Meio caminho do autoplay + clique manual: o próximo avanço automático
    // deve acontecer um intervalo INTEIRO depois do clique, não meio.
    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS / 2));
    act(() => result.current.goTo(1));

    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS / 2));
    expect(result.current.index).toBe(1);

    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS / 2));
    expect(result.current.index).toBe(2);
  });

  it("interpreta arrasto além do limiar como swipe, e abaixo dele como clique", () => {
    const { result } = renderHook(() => useCarousel(3));

    // Arrasto para a esquerda = próximo slide.
    act(() => {
      result.current.onPointerDown(200);
      result.current.onPointerUp(200 - CAROUSEL_SWIPE_THRESHOLD_PX);
    });
    expect(result.current.index).toBe(1);

    // Arrasto para a direita = slide anterior.
    act(() => {
      result.current.onPointerDown(100);
      result.current.onPointerUp(100 + CAROUSEL_SWIPE_THRESHOLD_PX);
    });
    expect(result.current.index).toBe(0);

    // Movimento pequeno não troca o slide.
    act(() => {
      result.current.onPointerDown(100);
      result.current.onPointerUp(110);
    });
    expect(result.current.index).toBe(0);
  });

  it("não agenda autoplay com um slide só", () => {
    const { result } = renderHook(() => useCarousel(1));

    act(() => vi.advanceTimersByTime(CAROUSEL_AUTOPLAY_MS * 3));
    expect(result.current.index).toBe(0);
  });
});
