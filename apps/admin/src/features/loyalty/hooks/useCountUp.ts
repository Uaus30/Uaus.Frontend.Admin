import { useEffect, useState } from "react";

/** Quanto dura a contagem do card, do zero ao número. */
const DURATION_MS = 900;

/**
 * O número do card "contando até o valor" quando ele aparece (pedido do dono,
 * 01/10/2026). Quem desligou animações no aparelho vê o número direto: o
 * movimento é enfeite, e enfeite não pode atrapalhar quem passa mal com ele.
 *
 * @param value O número final.
 * @returns O número a desenhar agora.
 */
export function useCountUp(value: number): number {
  const animate =
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!animate) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // Desacelera no fim: o número "assenta" no valor em vez de parar seco.
      setShown(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value, animate]);

  return animate ? shown : value;
}
