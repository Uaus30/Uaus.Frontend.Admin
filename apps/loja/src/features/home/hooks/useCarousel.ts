import { useCallback, useEffect, useRef, useState } from "react";

/** Intervalo do autoplay do carrossel de fotos, o mesmo do site original. */
export const CAROUSEL_AUTOPLAY_MS = 5000;

/** Deslocamento horizontal mínimo (px) para um arrasto contar como swipe. */
export const CAROUSEL_SWIPE_THRESHOLD_PX = 40;

export interface CarouselState {
  index: number;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  pause: () => void;
  resume: () => void;
  /** Registra o início do toque/arrasto para detectar swipe. */
  onPointerDown: (clientX: number) => void;
  /** Encerra o toque; dispara next/prev quando o arrasto passa do limiar. */
  onPointerUp: (clientX: number) => void;
}

/**
 * Estado do carrossel com autoplay, pausa no hover e swipe no toque.
 *
 * O site original tinha só o autoplay de 5 s; pausa e swipe são melhorias
 * deliberadas — autoplay que não pausa rouba a foto que a pessoa estava
 * olhando, e carrossel sem swipe em celular parece quebrado.
 *
 * O timer reinicia a cada interação manual (`goTo`/`next`/`prev`): sem isso,
 * quem clica numa bolinha vê o autoplay trocar a foto meio segundo depois.
 */
export function useCarousel(slideCount: number): CarouselState {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // O reinício do timer é um contador, não uma dependência do índice: avanço do
  // PRÓPRIO autoplay não deve reiniciar o relógio, só interação manual.
  const [timerEpoch, setTimerEpoch] = useState(0);
  const pointerStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (target: number) => {
      if (slideCount <= 0) return;
      setIndex(((target % slideCount) + slideCount) % slideCount);
      setTimerEpoch((epoch) => epoch + 1);
    },
    [slideCount],
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused || slideCount <= 1) return;

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, CAROUSEL_AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [paused, slideCount, timerEpoch]);

  const onPointerDown = useCallback((clientX: number) => {
    pointerStartX.current = clientX;
  }, []);

  const onPointerUp = useCallback(
    (clientX: number) => {
      if (pointerStartX.current == null) return;
      const delta = clientX - pointerStartX.current;
      pointerStartX.current = null;

      if (Math.abs(delta) < CAROUSEL_SWIPE_THRESHOLD_PX) return;
      // Arrastou para a esquerda = quer ver o próximo slide.
      if (delta < 0) next();
      else prev();
    },
    [next, prev],
  );

  return {
    index,
    next,
    prev,
    goTo,
    pause: useCallback(() => setPaused(true), []),
    resume: useCallback(() => setPaused(false), []),
    onPointerDown,
    onPointerUp,
  };
}
